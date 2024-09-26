use anchor_lang::prelude::*;

use crate::constants::{ROLES_ADMIN_ROLE_SEED, ROLES_SEED};
use crate::state::roles::*;

#[derive(Accounts)]
pub struct SetRole<'info> {
    #[account(
        init_if_needed, 
        seeds = [
            ROLES_SEED.as_bytes(),
            user.key().as_ref()
        ], 
        bump,  
        payer = signer, 
        space = AccountRoles::LEN,
    )]
    pub roles: Account<'info, AccountRoles>,

    #[account(seeds = [ROLES_ADMIN_ROLE_SEED.as_bytes()], bump)]
    pub roles_admin: Account<'info, RolesAdmin>,

    #[account(mut, address = roles_admin.account)]
    pub signer: Signer<'info>,

    /// CHECK: This should be a user account, not a signer
    #[account()]
    pub user: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_set_role(ctx: Context<SetRole>, role: Role) -> Result<()> {
    let roles = &mut ctx.accounts.roles;
    roles.account = ctx.accounts.user.key();
    roles.set_role(role)
}
