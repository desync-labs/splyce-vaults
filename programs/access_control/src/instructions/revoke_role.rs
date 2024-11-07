use anchor_lang::prelude::*;

use crate::constants::{ROLE_MANAGER_SEED, USER_ROLE_SEED};
use crate::state::{RoleManager, UserRole};

#[derive(Accounts)]
#[instruction(role_id: u64, user: Pubkey)]
pub struct RevokeRole<'info> {
    #[account(
        mut, 
        seeds = [
            USER_ROLE_SEED.as_bytes(), 
            user.as_ref(), 
            role_id.to_le_bytes().as_ref()
        ],
        bump,
        close = recipient
    )]
    pub roles: Account<'info, UserRole>,
    
    #[account(seeds = [ROLE_MANAGER_SEED.as_bytes(), role_id.to_le_bytes().as_ref()], bump)]
    pub role_manager: Account<'info, RoleManager>,

    #[account(
        seeds = [
            USER_ROLE_SEED.as_bytes(), 
            signer.key().as_ref(), 
            role_manager.manager_role_id.to_le_bytes().as_ref()
        ], 
        bump
    )]
    pub signer_roles: Account<'info, UserRole>,

    #[account(mut, constraint = signer_roles.check_role()?)]
    pub signer: Signer<'info>,

    /// CHECK:
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_revoke_role(_ctx: Context<RevokeRole>, _role_id: u64, _user: Pubkey) -> Result<()> {
    Ok(())
}