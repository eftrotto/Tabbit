// Instruções da plataforma: pausa e credenciamento de restaurantes.
use anchor_lang::prelude::*;

use crate::errors::TabbitError;
use crate::state::{Config, Merchant, MAX_NAME_LEN};

pub const MAX_CATEGORY: u8 = 3;

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = authority @ TabbitError::Unauthorized)]
    pub config: Account<'info, Config>,
}

pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    Ok(())
}

#[derive(Accounts)]
#[instruction(wallet: Pubkey)]
pub struct RegisterMerchant<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump, has_one = authority @ TabbitError::Unauthorized)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = authority,
        space = 8 + Merchant::INIT_SPACE,
        seeds = [b"merchant", wallet.as_ref()],
        bump
    )]
    pub merchant: Account<'info, Merchant>,

    pub system_program: Program<'info, System>,
}

pub fn register_merchant(ctx: Context<RegisterMerchant>, wallet: Pubkey, name: String, category: u8) -> Result<()> {
    require!(name.len() <= MAX_NAME_LEN, TabbitError::NameTooLong);
    require!(category <= MAX_CATEGORY, TabbitError::InvalidAmount);

    let merchant = &mut ctx.accounts.merchant;
    merchant.wallet = wallet;
    merchant.name = name;
    merchant.category = category;
    merchant.active = true;
    merchant.bump = ctx.bumps.merchant;
    Ok(())
}

#[derive(Accounts)]
pub struct SetMerchantActive<'info> {
    pub authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump, has_one = authority @ TabbitError::Unauthorized)]
    pub config: Account<'info, Config>,

    #[account(mut, seeds = [b"merchant", merchant.wallet.as_ref()], bump = merchant.bump)]
    pub merchant: Account<'info, Merchant>,
}

pub fn set_merchant_active(ctx: Context<SetMerchantActive>, active: bool) -> Result<()> {
    ctx.accounts.merchant.active = active;
    Ok(())
}
