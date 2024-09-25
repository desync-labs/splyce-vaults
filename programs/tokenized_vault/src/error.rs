use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Vault was shutdown")]
    VaultShutdown,

    #[msg("Zero value")]
    ZeroValue,

    #[msg("Custom error message")]
    CustomError,

    #[msg("Invalid strategy data")]
    InvalidStrategyData,

    #[msg("Invalid strategy")]
    InvalidStrategy,

    #[msg("Invalid account type")]
    InvalidAccountType,

    #[msg("Max strategies reached")]
    StrategiesFull,

    #[msg("Strategy already added")]
    StrategyAlreadyAdded,

    #[msg("Strategy not found")]
    StrategyNotFound,

    #[msg("Strategy not active")]
    InactiveStrategy,

    #[msg("Debt is the same")]
    SameDebt,

    #[msg("Cannot withdraw")]
    CannotWithdraw,

    #[msg("Cannot deposit")]
    CannotDeposit,

    #[msg("Debt cannot be reduced because of unrealised losses")]
    UnrealisedLosses,

    #[msg("Debt cannot be higher than max debt")]
    DebtHigherThanMaxDebt,

    #[msg("Insufficient funds")]
    InsufficientFunds,

    #[msg("Min deposit not reached")]
    MinDepositNotReached,

    #[msg("Exceed deposit limit")]
    ExceedDepositLimit,

    #[msg("Insufficient shares")]
    InsufficientShares,

    #[msg("Is not a vault strategy")]
    IsNotVaultStrategy,

    #[msg("Exceed withdraw limit")]
    ExceedWithdrawLimit,

    #[msg("Invalid strategy / token account pairs")]
    InvalidAccountPairs,

    #[msg("Loss is too high")]
    TooMuchLoss,

    #[msg("Strategy has debt")]
    StrategyHasDebt,
}
