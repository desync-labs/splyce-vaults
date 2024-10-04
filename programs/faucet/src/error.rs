use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Faucet was shutdown")]
    FaucetStopped,

    #[msg("Faucet is empty")]
    EmptyFaucet,
}