// Tabbit: vale-refeição on-chain com regras programáveis.
// Dono: Dev A. Contrato completo em IMPLEMENTACAO.md (seção 4).
use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod time;

use instructions::*;

declare_id!("Gs1shhurWMwnqzzjdxtMkYMcXwXYDbaSd6hP74JvEFBn");

#[program]
pub mod tabbit {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, fee_bps: u16, treasury: Pubkey) -> Result<()> {
        instructions::initialize::handler(ctx, fee_bps, treasury)
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::admin::set_paused(ctx, paused)
    }

    pub fn register_employer(ctx: Context<RegisterEmployer>, name: String, tz_offset_minutes: i16) -> Result<()> {
        instructions::employer::register_employer(ctx, name, tz_offset_minutes)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::employer::deposit(ctx, amount)
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
        instructions::employer::upsert_employee(
            ctx,
            wallet,
            balance,
            max_per_meal,
            daily_cap,
            window_start_min,
            window_end_min,
        )
    }

    pub fn revoke_employee(ctx: Context<RevokeEmployee>) -> Result<()> {
        instructions::employer::revoke_employee(ctx)
    }

    pub fn withdraw_unallocated(ctx: Context<WithdrawUnallocated>, amount: u64) -> Result<()> {
        instructions::employer::withdraw_unallocated(ctx, amount)
    }

    pub fn register_merchant(ctx: Context<RegisterMerchant>, wallet: Pubkey, name: String, category: u8) -> Result<()> {
        instructions::admin::register_merchant(ctx, wallet, name, category)
    }

    pub fn set_merchant_active(ctx: Context<SetMerchantActive>, active: bool) -> Result<()> {
        instructions::admin::set_merchant_active(ctx, active)
    }

    pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
        instructions::pay::pay(ctx, amount)
    }
}
