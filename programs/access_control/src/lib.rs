use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use crate::instructions::*;
use crate::state::*;

declare_id!("BDoMP91kwyaV4Y2dCFJS6dRSGenBQXNkcUfJk1Tw8bpW");

#[program]
pub mod access_control {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        handle_initialize(ctx)
    }

    pub fn set_role(ctx: Context<SetRole>, role: Role, user: Pubkey) -> Result<()> {
        handle_set_role(ctx, role, user)
    }

    pub fn drop_role(ctx: Context<DropRole>, role: Role) -> Result<()> {
        handle_drop_role(ctx, role)
    }
}