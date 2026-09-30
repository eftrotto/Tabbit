// Tabbit: vale-refeição on-chain com regras programáveis.
// Dono: Dev A. Contrato completo em IMPLEMENTACAO.md (seção 4).
use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("2Mh4bbby1Fu7zhdygoK634QgGaemQGsTg5vx8JHFjemF");

#[program]
pub mod tabbit {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, fee_bps: u16, treasury: Pubkey) -> Result<()> {
        instructions::initialize::handler(ctx, fee_bps, treasury)
    }

    // TODO (Dev A): implementar, cada uma no seu arquivo em instructions/
    // set_paused(paused: bool)
    // register_employer(name: String, tz_offset_minutes: i16)
    // deposit(amount: u64)
    // upsert_employee(wallet: Pubkey, balance: u64, max_per_meal: u64, daily_cap: u64, window_start_min: u16, window_end_min: u16)
    // revoke_employee()
    // withdraw_unallocated(amount: u64)
    // register_merchant(wallet: Pubkey, name: String, category: u8)
    // set_merchant_active(active: bool)
    // pay(amount: u64)
}
