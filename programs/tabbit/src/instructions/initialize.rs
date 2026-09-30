use anchor_lang::prelude::*;

use crate::errors::TabbitError;
use crate::state::{Config, BPS_DENOMINATOR};

/// Cria a Config global. Só pode ser chamada uma vez (o PDA ["config"] já existiria na segunda).
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, fee_bps: u16, treasury: Pubkey) -> Result<()> {
    require!((fee_bps as u64) < BPS_DENOMINATOR, TabbitError::InvalidAmount);

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.treasury = treasury;
    config.fee_bps = fee_bps;
    config.paused = false;
    config.bump = ctx.bumps.config;
    Ok(())
}
