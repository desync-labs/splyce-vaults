use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use crate::instructions::*;

declare_id!("BDoMP91kwyaV4Y2dCFJS6dRSGenBQXNkcUfJk1Tw8bpW");

#[program]
pub mod access_control {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        handle_initialize(ctx)
    }

    pub fn set_role(ctx: Context<SetRole>, role_id: u64, user: Pubkey, value: bool) -> Result<()> {
        handle_set_role(ctx, role_id, user, value)
    }

    pub fn set_role_manager(ctx: Context<SetRoleManager>, role_id: u64, manager_role_id: u64) -> Result<()> {
        handle_set_role_manager(ctx, role_id, manager_role_id)
    }
}