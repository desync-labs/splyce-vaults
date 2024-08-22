use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,

    #[msg("Invalid strategy config")]
    InvalidStrategyConfig,

    #[msg("Invalid account type")]
    InvalidAccountType,
}
