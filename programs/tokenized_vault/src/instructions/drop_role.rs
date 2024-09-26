use anchor_lang::prelude::*;

use crate::constants::{ROLES_ADMIN_ROLE_SEED, ROLES_SEED};
use crate::state::roles::*;

#[derive(Accounts)]
pub struct DropRole<'info> {
    #[account(
        mut, 
        seeds = [
            ROLES_SEED.as_bytes(),
            user.key().as_ref()
        ], 
        bump,  
    )]
    pub roles: Account<'info, AccountRoles>,

    #[account(seeds = [ROLES_ADMIN_ROLE_SEED.as_bytes()], bump)]
    pub roles_admin: Account<'info, RolesAdmin>,

    #[account(mut, address = roles_admin.account)]
    pub signer: Signer<'info>,

    /// CHECK: This should be a user account, not a signer
    #[account()]
    pub user: AccountInfo<'info>,
}

pub fn handle_drop_role(ctx: Context<DropRole>, role: Role) -> Result<()> {
    let roles = &mut ctx.accounts.roles;
    roles.drop_role(role)
}
