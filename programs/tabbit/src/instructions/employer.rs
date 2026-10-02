// Instruções da empresa: cadastro, depósito, funcionários e saque do que não foi alocado.
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::TabbitError;
use crate::state::{Config, Employee, Employer, EmployerApproval, MAX_NAME_LEN};
use crate::time::validate_window;

/// Fusos válidos: UTC-12 até UTC+14.
const MIN_TZ_OFFSET: i16 = -720;
const MAX_TZ_OFFSET: i16 = 840;

// ---------- register_employer ----------

#[derive(Accounts)]
pub struct RegisterEmployer<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Employer::INIT_SPACE,
        seeds = [b"employer", owner.key().as_ref()],
        bump
    )]
    pub employer: Account<'info, Employer>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    /// Só o token oficial do benefício: impede empresa com token próprio sem valor.
    #[account(address = config.mint @ TabbitError::InvalidMint)]
    pub mint: Account<'info, Mint>,

    /// Cofre: ATA do mint cujo dono é o PDA da empresa.
    #[account(
        init,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = employer
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn register_employer(ctx: Context<RegisterEmployer>, name: String, tz_offset_minutes: i16) -> Result<()> {
    require!(name.len() <= MAX_NAME_LEN, TabbitError::NameTooLong);
    require!(
        (MIN_TZ_OFFSET..=MAX_TZ_OFFSET).contains(&tz_offset_minutes),
        TabbitError::InvalidWindow
    );

    let employer = &mut ctx.accounts.employer;
    employer.owner = ctx.accounts.owner.key();
    employer.name = name;
    employer.mint = ctx.accounts.mint.key();
    employer.vault = ctx.accounts.vault.key();
    employer.tz_offset_minutes = tz_offset_minutes;
    employer.total_deposited = 0;
    employer.total_allocated = 0;
    employer.bump = ctx.bumps.employer;
    Ok(())
}

// ---------- deposit ----------

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"employer", owner.key().as_ref()],
        bump = employer.bump,
        has_one = owner @ TabbitError::Unauthorized,
        has_one = vault
    )]
    pub employer: Account<'info, Employer>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    /// Conta de token da empresa de onde sai o dinheiro.
    #[account(
        mut,
        token::mint = employer.mint,
        token::authority = owner
    )]
    pub owner_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,

    /// Empresa precisa estar aprovada pela plataforma para colocar dinheiro na rede.
    #[account(
        seeds = [b"approval", employer.key().as_ref()],
        bump = approval.bump,
        constraint = approval.approved @ TabbitError::EmployerNotApproved
    )]
    pub approval: Account<'info, EmployerApproval>,
}

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, TabbitError::InvalidAmount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
    )?;

    let employer = &mut ctx.accounts.employer;
    employer.total_deposited = employer
        .total_deposited
        .checked_add(amount)
        .ok_or(TabbitError::InvalidAmount)?;
    Ok(())
}

// ---------- upsert_employee ----------

#[derive(Accounts)]
#[instruction(wallet: Pubkey)]
pub struct UpsertEmployee<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"employer", owner.key().as_ref()],
        bump = employer.bump,
        has_one = owner @ TabbitError::Unauthorized
    )]
    pub employer: Account<'info, Employer>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + Employee::INIT_SPACE,
        seeds = [b"employee", employer.key().as_ref(), wallet.as_ref()],
        bump
    )]
    pub employee: Account<'info, Employee>,

    pub system_program: Program<'info, System>,
}

pub fn upsert_employee(
    ctx: Context<UpsertEmployee>,
    wallet: Pubkey,
    balance: u64,
    max_per_meal: u64,
    daily_cap: u64,
    window_start_min: u16,
    window_end_min: u16,
) -> Result<()> {
    require!(max_per_meal > 0 && daily_cap > 0, TabbitError::InvalidAmount);
    validate_window(window_start_min, window_end_min)?;

    let employer = &mut ctx.accounts.employer;
    let employee = &mut ctx.accounts.employee;
    let is_new = employee.wallet == Pubkey::default();

    // Troca o saldo antigo pelo novo no total alocado da empresa.
    let old_balance = if is_new { 0 } else { employee.balance };
    let new_total = employer
        .total_allocated
        .checked_sub(old_balance)
        .and_then(|v| v.checked_add(balance))
        .ok_or(TabbitError::InvalidAmount)?;
    require!(new_total <= employer.total_deposited, TabbitError::OverAllocated);
    employer.total_allocated = new_total;

    if is_new {
        employee.employer = employer.key();
        employee.wallet = wallet;
        employee.spent_today = 0;
        employee.last_spend_day = 0;
        employee.bump = ctx.bumps.employee;
    }
    employee.balance = balance;
    employee.max_per_meal = max_per_meal;
    employee.daily_cap = daily_cap;
    employee.window_start_min = window_start_min;
    employee.window_end_min = window_end_min;
    employee.active = true;
    Ok(())
}

// ---------- revoke_employee ----------

#[derive(Accounts)]
pub struct RevokeEmployee<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"employer", owner.key().as_ref()],
        bump = employer.bump,
        has_one = owner @ TabbitError::Unauthorized
    )]
    pub employer: Account<'info, Employer>,

    #[account(
        mut,
        seeds = [b"employee", employer.key().as_ref(), employee.wallet.as_ref()],
        bump = employee.bump,
        has_one = employer @ TabbitError::Unauthorized
    )]
    pub employee: Account<'info, Employee>,
}

pub fn revoke_employee(ctx: Context<RevokeEmployee>) -> Result<()> {
    let employer = &mut ctx.accounts.employer;
    let employee = &mut ctx.accounts.employee;

    employer.total_allocated = employer
        .total_allocated
        .checked_sub(employee.balance)
        .ok_or(TabbitError::InvalidAmount)?;
    employee.balance = 0;
    employee.active = false;
    Ok(())
}

// ---------- withdraw_unallocated ----------

#[derive(Accounts)]
pub struct WithdrawUnallocated<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"employer", owner.key().as_ref()],
        bump = employer.bump,
        has_one = owner @ TabbitError::Unauthorized,
        has_one = vault
    )]
    pub employer: Account<'info, Employer>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    /// Para onde volta o dinheiro (conta de token da empresa).
    #[account(
        mut,
        token::mint = employer.mint,
        token::authority = owner
    )]
    pub owner_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn withdraw_unallocated(ctx: Context<WithdrawUnallocated>, amount: u64) -> Result<()> {
    require!(amount > 0, TabbitError::InvalidAmount);
    let employer = &ctx.accounts.employer;
    let free = employer
        .total_deposited
        .checked_sub(employer.total_allocated)
        .ok_or(TabbitError::InvalidAmount)?;
    require!(amount <= free, TabbitError::InsufficientBalance);

    let owner_key = employer.owner;
    let seeds: &[&[u8]] = &[b"employer", owner_key.as_ref(), &[employer.bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.owner_token.to_account_info(),
                authority: ctx.accounts.employer.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    let employer = &mut ctx.accounts.employer;
    employer.total_deposited -= amount;
    Ok(())
}
