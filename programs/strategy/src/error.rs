use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,

    #[msg("Invalid strategy config")]
    InvalidStrategyConfig,

    #[msg("Invalid account type")]
    InvalidAccountType,

    #[msg("Invalid strategy data")]
    InvalidStrategyData,

    #[msg("Cannot withdraw")]
    CannotWithdraw,

    #[msg("Debt cannot be reduced because of unrealised losses")]
    UnrealisedLosses,
}
