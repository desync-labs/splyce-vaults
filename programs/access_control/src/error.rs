use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Signer has no access")]
    AccessDenied,
}
