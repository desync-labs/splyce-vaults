use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};

#[account]
#[derive(Default, Debug)]
pub struct RolesAdmin {
    pub account: Pubkey,
}

#[account]
#[derive(Default, Debug)]
pub struct AccountRoles {
    pub account: Pubkey,
    pub is_vaults_admin: bool,
    pub is_reporting_manager: bool,
    pub is_whitelisted: bool,
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum Role {
    Whitelisted,
    VaultsAdmin,
    ReportingManager,
}

impl RolesAdmin {
    pub const LEN: usize = 8 + 32;
}

impl AccountRoles {
    pub const LEN: usize = 8 + 32 + 1 + 1 + 1;


    pub fn set_role(&mut self, role: Role) -> Result<()> {
        match role {
            Role::Whitelisted => {
                self.is_whitelisted = true;
            }
            Role::VaultsAdmin => {
                self.is_vaults_admin = true;
            }
            Role::ReportingManager => {
                self.is_reporting_manager = true;
            }
        }

        Ok(())
    }

    pub fn drop_role(&mut self, role: Role) -> Result<()> {
        match role {
            Role::Whitelisted => {
                self.is_whitelisted = false;
            }
            Role::VaultsAdmin => {
                self.is_vaults_admin = false;
            }
            Role::ReportingManager => {
                self.is_reporting_manager = false;
            }
        }

        Ok(())
    }
}