// O coração do Tabbit: funcionário paga restaurante credenciado, com todas as regras conferidas on-chain.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::TabbitError;
use crate::events::PaymentMade;
use crate::state::{Config, Employee, Employer, Merchant, BPS_DENOMINATOR};
use crate::time::{is_within_window, local_day_and_minute};

#[derive(Accounts)]
pub struct Pay<'info> {
    /// Carteira do funcionário.
    pub payer: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    #[account(
        mut,
        seeds = [b"employer", employer.owner.as_ref()],
        bump = employer.bump,
        has_one = vault
    )]
    pub employer: Box<Account<'info, Employer>>,

    #[account(
        mut,
        seeds = [b"employee", employer.key().as_ref(), payer.key().as_ref()],
        bump = employee.bump,
        has_one = employer @ TabbitError::Unauthorized
    )]
    pub employee: Box<Account<'info, Employee>>,

    #[account(seeds = [b"merchant", merchant.wallet.as_ref()], bump = merchant.bump)]
    pub merchant: Box<Account<'info, Merchant>>,

    #[account(mut)]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// Conta de token do restaurante (precisa existir; o SDK cria se faltar).
    #[account(
        mut,
        token::mint = employer.mint,
        token::authority = merchant.wallet
    )]
    pub merchant_token: Box<Account<'info, TokenAccount>>,

    /// Conta de token da tesouraria da plataforma (recebe a taxa).
    #[account(
        mut,
        token::mint = employer.mint,
        token::authority = config.treasury
    )]
    pub treasury_token: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, TabbitError::Paused);

    let merchant = &ctx.accounts.merchant;
    let employee = &ctx.accounts.employee;
    require!(employee.active, TabbitError::EmployeeInactive);
    require!(merchant.active, TabbitError::MerchantInactive);
    require!(amount > 0, TabbitError::InvalidAmount);
    require!(amount <= employee.max_per_meal, TabbitError::ExceedsMaxPerMeal);
    require!(amount <= employee.balance, TabbitError::InsufficientBalance);

    let now = Clock::get()?.unix_timestamp;
    let (today, minute) = local_day_and_minute(now, ctx.accounts.employer.tz_offset_minutes);
    let spent_today = if employee.last_spend_day == today { employee.spent_today } else { 0 };
    let new_spent = spent_today.checked_add(amount).ok_or(TabbitError::InvalidAmount)?;
    require!(new_spent <= employee.daily_cap, TabbitError::ExceedsDailyCap);
    require!(
        is_within_window(minute, employee.window_start_min, employee.window_end_min),
        TabbitError::OutsideTimeWindow
    );

    // Taxa arredondada para baixo; o restaurante recebe o resto.
    let fee = ((amount as u128) * (config.fee_bps as u128) / (BPS_DENOMINATOR as u128)) as u64;
    let to_merchant = amount - fee;

    let owner_key = ctx.accounts.employer.owner;
    let bump = ctx.accounts.employer.bump;
    let seeds: &[&[u8]] = &[b"employer", owner_key.as_ref(), &[bump]];
    let signer = &[seeds];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.merchant_token.to_account_info(),
                authority: ctx.accounts.employer.to_account_info(),
            },
            signer,
        ),
        to_merchant,
    )?;
    if fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: ctx.accounts.employer.to_account_info(),
                },
                signer,
            ),
            fee,
        )?;
    }

    let employee = &mut ctx.accounts.employee;
    employee.balance -= amount;
    employee.spent_today = new_spent;
    employee.last_spend_day = today;

    let employer = &mut ctx.accounts.employer;
    employer.total_allocated -= amount;
    employer.total_deposited -= amount;

    emit!(PaymentMade {
        employer: employer.key(),
        employee: employee.wallet,
        merchant: ctx.accounts.merchant.wallet,
        amount,
        fee,
        timestamp: now,
    });
    Ok(())
}
