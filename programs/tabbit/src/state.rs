// Contas do programa. Estes campos fazem parte do CONTRATO (ver sdk/src/types.ts e IMPLEMENTACAO.md, seção 4.2).
// Mudou algo aqui? Atualize types.ts no mesmo PR e avise o outro dev.
use anchor_lang::prelude::*;

pub const MAX_NAME_LEN: usize = 32;
pub const BPS_DENOMINATOR: u64 = 10_000;

/// Seeds: ["config"]
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub paused: bool,
    pub bump: u8,
}

/// Seeds: ["employer", owner]
#[account]
#[derive(InitSpace)]
pub struct Employer {
    pub owner: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub mint: Pubkey,
    /// ATA do `mint` cujo dono é este PDA
    pub vault: Pubkey,
    /// Fuso da empresa em minutos (Brasília = -180)
    pub tz_offset_minutes: i16,
    pub total_deposited: u64,
    pub total_allocated: u64,
    pub bump: u8,
}

/// Seeds: ["employee", employer, wallet]
#[account]
#[derive(InitSpace)]
pub struct Employee {
    pub employer: Pubkey,
    pub wallet: Pubkey,
    pub balance: u64,
    pub max_per_meal: u64,
    pub daily_cap: u64,
    pub spent_today: u64,
    pub last_spend_day: i64,
    /// Minutos do dia (0..=1440). Ambos 0 = sem janela.
    pub window_start_min: u16,
    pub window_end_min: u16,
    pub active: bool,
    pub bump: u8,
}

/// Seeds: ["merchant", wallet]
#[account]
#[derive(InitSpace)]
pub struct Merchant {
    pub wallet: Pubkey,
    #[max_len(32)]
    pub name: String,
    /// 0 = restaurant, 1 = cafe, 2 = grocery, 3 = other
    pub category: u8,
    pub active: bool,
    pub bump: u8,
}
