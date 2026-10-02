// Instruções da plataforma: pausa, token oficial, aprovação de empresas e credenciamento de restaurantes.
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::Discriminator;
use anchor_spl::token::Mint;

use crate::errors::TabbitError;
use crate::state::{Config, Employer, EmployerApproval, Merchant, MAX_NAME_LEN};

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

// ---------- set_mint ----------

/// Define o token oficial do benefício. Também migra a Config criada antes deste campo existir:
/// a conta antiga é menor, então ela é lida como bytes, aumentada e o mint é escrito no fim.
#[derive(Accounts)]
pub struct SetMint<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: lida à mão porque a versão antiga não desserializa como `Config`; dono, discriminador
    /// e autoridade são conferidos no handler.
    #[account(mut, seeds = [b"config"], bump)]
    pub config: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

// Posições na conta: discriminador (8) + authority (32) + treasury (32) + fee_bps (2) + paused (1) + bump (1)
const CONFIG_AUTHORITY_OFFSET: usize = 8;
const CONFIG_MINT_OFFSET: usize = 8 + 32 + 32 + 2 + 1 + 1;

pub fn set_mint(ctx: Context<SetMint>) -> Result<()> {
    let config = ctx.accounts.config.to_account_info();
    require_keys_eq!(*config.owner, crate::ID, TabbitError::Unauthorized);
    {
        let data = config.try_borrow_data()?;
        require!(data.len() >= CONFIG_MINT_OFFSET && &data[..8] == Config::DISCRIMINATOR, TabbitError::Unauthorized);
        let authority = Pubkey::try_from(&data[CONFIG_AUTHORITY_OFFSET..CONFIG_AUTHORITY_OFFSET + 32]).unwrap();
        require_keys_eq!(authority, ctx.accounts.authority.key(), TabbitError::Unauthorized);
    }

    let new_len = 8 + Config::INIT_SPACE;
    if config.data_len() < new_len {
        let missing = Rent::get()?.minimum_balance(new_len).saturating_sub(config.lamports());
        if missing > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer { from: ctx.accounts.authority.to_account_info(), to: config.clone() },
                ),
                missing,
            )?;
        }
        config.resize(new_len)?;
    }

    let mut data = config.try_borrow_mut_data()?;
    data[CONFIG_MINT_OFFSET..CONFIG_MINT_OFFSET + 32].copy_from_slice(ctx.accounts.mint.key().as_ref());
    Ok(())
}

// ---------- set_employer_approved ----------

#[derive(Accounts)]
pub struct SetEmployerApproved<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump, has_one = authority @ TabbitError::Unauthorized)]
    pub config: Account<'info, Config>,

    pub employer: Account<'info, Employer>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + EmployerApproval::INIT_SPACE,
        seeds = [b"approval", employer.key().as_ref()],
        bump
    )]
    pub approval: Account<'info, EmployerApproval>,

    pub system_program: Program<'info, System>,
}

pub fn set_employer_approved(ctx: Context<SetEmployerApproved>, approved: bool) -> Result<()> {
    if approved {
        require_keys_eq!(ctx.accounts.employer.mint, ctx.accounts.config.mint, TabbitError::InvalidMint);
    }
    let approval = &mut ctx.accounts.approval;
    approval.employer = ctx.accounts.employer.key();
    approval.approved = approved;
    approval.bump = ctx.bumps.approval;
    Ok(())
}
