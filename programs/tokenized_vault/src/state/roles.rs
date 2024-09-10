use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};

use crate::error::ErrorCode;
use crate::utils::strategy;

#[account]
#[derive(Default, Debug)]
pub struct Roles {
    pub protocol_admin: Pubkey,
    pub vaults_admin: Pubkey,
    pub reporting_manager: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum Role {
    ProtocolAdmin,
    VaultsAdmin,
    ReportingManager,
}

impl Roles {
    pub const LEN : usize = 8 + 32 + 32 +  32;

    pub fn set_role(&mut self, role: Role, new_role: Pubkey) -> Result<()> {
        match role {
            Role::ProtocolAdmin => {
                self.protocol_admin = new_role;
            }
            Role::VaultsAdmin => {
                self.vaults_admin = new_role;
            }
            Role::ReportingManager => {
                self.reporting_manager = new_role;
            }
        }

        Ok(())
    }

    // pub fn has_role(&self, role: Role, account: &Pubkey) -> Result<()> {
    //     match role {
    //         Role::ProtocolAdmin => {
    //             if self.protocol_admin != *account {
    //                 return Err(ErrorCode::Unauthorized.into());
    //             }
    //         }
    //         Role::VaultsAdmin => {
    //             if self.vaults_admin != *account {
    //                 return Err(ErrorCode::Unauthorized.into());
    //             }
    //         }
    //         Role::ReportingManager => {
    //             if self.reporting_manager != *account {
    //                 return Err(ErrorCode::Unauthorized.into());
    //             }
    //         }
    //     }

    //     Ok(())
    // }
}