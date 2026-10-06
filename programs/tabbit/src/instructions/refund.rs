// Estorno: o restaurante devolve um pagamento. O dinheiro sai da conta de token do restaurante,
// volta para o cofre da empresa e o saldo volta para o funcionário (e libera o gasto do dia).
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::TabbitError;
use crate::events::RefundMade;
use crate::state::{Employee, Employer, Merchant};
use crate::time::local_day_and_minute;

#[derive(Accounts)]
pub struct Refund<'info> {
    /// Carteira do restaurante.
    pub merchant_wallet: Signer<'info>,

    /// Restaurante descredenciado ainda pode devolver o que recebeu.
    #[account(
        seeds = [b"merchant", merchant_wallet.key().as_ref()],
        bump = merchant.bump,
        constraint = merchant.wallet == merchant_wallet.key() @ TabbitError::Unauthorized
    )]
    pub merchant: Account<'info, Merchant>,

    #[account(
        mut,
        seeds = [b"employer", employer.owner.as_ref()],
        bump = employer.bump,
        has_one = vault
    )]
    pub employer: Account<'info, Employer>,

    #[account(
        mut,
        seeds = [b"employee", employer.key().as_ref(), employee.wallet.as_ref()],
        bump = employee.bump,
        has_one = employer @ TabbitError::Unauthorized
    )]
    pub employee: Account<'info, Employee>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = employer.mint,
        token::authority = merchant_wallet
    )]
    pub merchant_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// `reference`: assinatura do pagamento estornado. Não é verificada on-chain (o restaurante só
/// devolve dinheiro próprio); vai no evento para o app ligar o estorno ao pagamento e auditar.
pub fn refund(ctx: Context<Refund>, amount: u64, reference: [u8; 64]) -> Result<()> {
    require!(amount > 0, TabbitError::InvalidAmount);
    // Funcionário revogado já teve o saldo devolvido à empresa: não há para onde estornar
    require!(ctx.accounts.employee.active, TabbitError::EmployeeInactive);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.merchant_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.merchant_wallet.to_account_info(),
            },
        ),
        amount,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let (today, _) = local_day_and_minute(now, ctx.accounts.employer.tz_offset_minutes);

    let employee = &mut ctx.accounts.employee;
    employee.balance = employee.balance.checked_add(amount).ok_or(TabbitError::InvalidAmount)?;
    if employee.last_spend_day == today {
        employee.spent_today = employee.spent_today.saturating_sub(amount);
    }

    let employer = &mut ctx.accounts.employer;
    employer.total_deposited = employer.total_deposited.checked_add(amount).ok_or(TabbitError::InvalidAmount)?;
    employer.total_allocated = employer.total_allocated.checked_add(amount).ok_or(TabbitError::InvalidAmount)?;

    emit!(RefundMade {
        employer: employer.key(),
        employee: employee.wallet,
        merchant: ctx.accounts.merchant.wallet,
        amount,
        reference,
        timestamp: now,
    });
    Ok(())
}
