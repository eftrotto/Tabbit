// Ordem e nomes fazem parte do CONTRATO (TabbitErrorCode em sdk/src/types.ts).
use anchor_lang::prelude::*;

#[error_code]
pub enum TabbitError {
    #[msg("Payments are paused")]
    Paused,
    #[msg("Signer is not allowed to do this")]
    Unauthorized,
    #[msg("Employee is not active")]
    EmployeeInactive,
    #[msg("Merchant is not active")]
    MerchantInactive,
    #[msg("Amount exceeds the per-meal limit")]
    ExceedsMaxPerMeal,
    #[msg("Amount exceeds the daily limit")]
    ExceedsDailyCap,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Outside the allowed time window")]
    OutsideTimeWindow,
    #[msg("Allocated balance would exceed deposited funds")]
    OverAllocated,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Name is too long")]
    NameTooLong,
    #[msg("Invalid time window")]
    InvalidWindow,
    #[msg("Company is not approved by Tabbit yet")]
    EmployerNotApproved,
    #[msg("Token is not the official benefit token")]
    InvalidMint,
}
