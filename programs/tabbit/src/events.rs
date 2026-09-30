use anchor_lang::prelude::*;

/// Emitido a cada `pay`. O SDK lê este evento para montar o histórico.
#[event]
pub struct PaymentMade {
    pub employer: Pubkey,
    /// wallet do funcionário
    pub employee: Pubkey,
    /// wallet do restaurante
    pub merchant: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub timestamp: i64,
}
