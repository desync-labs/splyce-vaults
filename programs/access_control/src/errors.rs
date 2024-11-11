use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Signer has no access")]
    AccessDenied,

    #[msg("set_role_admin fn must be called by the owner")]
    CannotSetRoleAdmin,

    #[msg("Role id is invalid")]
    InvalidRoleId,
}
