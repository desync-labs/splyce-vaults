use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use num_derive::FromPrimitive;    

use crate::errors::ErrorCode;

#[account]
#[derive(Debug, InitSpace)]
pub struct UserRole {
    pub has_role: bool,
}

impl UserRole {
    pub fn check_role(&self) -> Result<bool> {
        if !self.has_role {
            return Err(ErrorCode::AccessDenied.into());
        }
        Ok(true)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, InitSpace, PartialEq, FromPrimitive)]
pub enum Role {
    RolesAdmin,
    VaultsAdmin,
    ReportingManager,
    StrategiesManager,
    AccountantAdmin,
    KYCProvider,
    KYCVerified,
}

impl Role {
    pub fn to_seed(self) -> [u8; 8] {
        (self as u64).to_le_bytes()
    }
}