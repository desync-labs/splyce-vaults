use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};

use crate::error::ErrorCode;

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct AccountRoles {
    pub account: Pubkey,
    pub is_vaults_admin: bool,
    pub is_strategies_manager: bool,
    pub is_reporting_manager: bool,
    pub is_whitelisted: bool,
    pub is_accountant_admin: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum Role {
    Whitelisted,
    VaultsAdmin,
    ReportingManager,
    StrategiesManager,
    AccountantAdmin,
}

impl AccountRoles {
    pub fn only_vaults_admin(&self) -> Result<bool> {
        self.check_role(Role::VaultsAdmin)
    }

    pub fn only_reporting_manager(&self) -> Result<bool> {
        self.check_role(Role::ReportingManager)
    }

    pub fn only_strategies_manager(&self) -> Result<bool> {
        self.check_role(Role::StrategiesManager)
    }

    pub fn only_whitelisted(&self) -> Result<bool> {
        self.check_role(Role::Whitelisted)
    }

    pub fn only_accountant_admin(&self) -> Result<bool> {
        self.check_role(Role::AccountantAdmin)
    }

    pub fn check_role(&self, role: Role) -> Result<bool> {
        match role {
            Role::Whitelisted => {
                if !self.is_whitelisted {
                    return Err(ErrorCode::AccessDenied.into());
                }
            }
            Role::VaultsAdmin => {
                if !self.is_vaults_admin {
                    return Err(ErrorCode::AccessDenied.into());
                }
            }
            Role::ReportingManager => {
                if !self.is_reporting_manager {
                    return Err(ErrorCode::AccessDenied.into());
                }
            }
            Role::StrategiesManager => {
                if !self.is_strategies_manager {
                    return Err(ErrorCode::AccessDenied.into());
                }
            }
            Role::AccountantAdmin => {
                if !self.is_accountant_admin {
                    return Err(ErrorCode::AccessDenied.into());
                }
            }
        }

        Ok(true)
    }

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
            Role::StrategiesManager => {
                self.is_strategies_manager = true;
            }
            Role::AccountantAdmin => {
                self.is_accountant_admin = true;
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
            Role::StrategiesManager => {
                self.is_strategies_manager = false;
            }
            Role::AccountantAdmin => {
                self.is_accountant_admin = false;
            }
        }

        Ok(())
    }
}