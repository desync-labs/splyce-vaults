use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};

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
}