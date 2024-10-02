use anchor_lang::prelude::*;

use crate::constants::{ROLES_ADMIN_ROLE_SEED, ROLES_SEED, DISCRIMINATOR_LEN};
use crate::state::roles::*;
use crate::state::roles_admin::*;

#[derive(Accounts)]
#[instruction(role: Role, user: Pubkey)]
pub struct SetRole<'info> {
    #[account(
        init_if_needed, 
        seeds = [
            ROLES_SEED.as_bytes(),
            user.as_ref()
        ], 
        bump,  
        payer = signer, 
        space = DISCRIMINATOR_LEN + AccountRoles::INIT_SPACE,
    )]
    pub roles: Account<'info, AccountRoles>,

    #[account(seeds = [ROLES_ADMIN_ROLE_SEED.as_bytes()], bump)]
    pub roles_admin: Account<'info, RolesAdmin>,

    #[account(mut, address = roles_admin.account)]
    pub signer: Signer<'info>,

    // /// CHECK: 
    // #[account()]
    // pub user: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_set_role(ctx: Context<SetRole>, role: Role, user: Pubkey) -> Result<()> {
    let roles = &mut ctx.accounts.roles;
    roles.account = user;
    roles.set_role(role)
}
