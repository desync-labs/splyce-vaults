use anchor_lang::prelude::*;

use crate::constants::{DISCRIMINATOR_LEN, ROLE_MANAGER_SEED, USER_ROLE_SEED, CONFIG_SEED};
use crate::state::{UserRole, RoleManager, Role, Config};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, 
        seeds = [ROLE_MANAGER_SEED.as_bytes(), Role::RolesAdmin.to_seed().as_ref()],
        bump,  
        payer = admin, 
        space = DISCRIMINATOR_LEN + RoleManager::INIT_SPACE,
    )]
    pub role_owners: Account<'info, RoleManager>,

    #[account(
        init, 
        seeds = [
            USER_ROLE_SEED.as_bytes(),
            admin.key().as_ref(),
            Role::RolesAdmin.to_seed().as_ref()
        ], 
        bump,  
        payer = admin, 
        space = DISCRIMINATOR_LEN + UserRole::INIT_SPACE,
    )]
    pub roles: Account<'info, UserRole>,

    #[account(
        init,
        seeds = [CONFIG_SEED.as_bytes()],
        bump,
        payer = admin,
        space = DISCRIMINATOR_LEN + Config::INIT_SPACE,
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_initialize(ctx: Context<Initialize>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.owner = ctx.accounts.admin.key();

    ctx.accounts.role_owners.manager_role_id = Role::RolesAdmin as u64;
    ctx.accounts.roles.has_role = true;

    Ok(())
}
