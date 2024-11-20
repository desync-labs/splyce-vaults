use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid strategy config")]
    InvalidStrategyConfig,

    #[msg("Invalid strategy data")]
    InvalidStrategyData,

    #[msg("Invalid account")]
    InvalidAccount,

    #[msg("Cannot serialize strategy")]
    SerializationError,

    #[msg("Insufficient funds")]
    InsufficientFunds,

    #[msg("Max deposit reached")]
    MaxDepositReached,

    #[msg("Signer has no access")]
    AccessDenied,

    #[msg("Loss is too high")]
    LossTooHigh,

    #[msg("Invalid strategy type")]
    InvalidStrategyType
}
