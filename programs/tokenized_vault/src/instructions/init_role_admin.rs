use anchor_lang::prelude::*;

use crate::constants::ROLES_ADMIN_ROLE_SEED;
use crate::state::roles::*;

#[derive(Accounts)]
pub struct InitializeRoleAdmin<'info> {
    // TODO: need to think about proper seeds
    #[account(
        init, 
        seeds = [ROLES_ADMIN_ROLE_SEED.as_bytes()], 
        bump,  
        payer = admin, 
        space = RolesAdmin::LEN,
    )]
    pub roles_admin: Account<'info, RolesAdmin>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_init_role_admin(ctx: Context<InitializeRoleAdmin>) -> Result<()> {
    let role = &mut ctx.accounts.roles_admin;
    role.account = ctx.accounts.admin.key();
    Ok(())
}
