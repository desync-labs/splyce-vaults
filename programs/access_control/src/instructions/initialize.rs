use anchor_lang::prelude::*;

use crate::constants::{ DISCRIMINATOR_LEN, ROLES_ADMIN_SEED};
use crate::state::roles_admin::RolesAdmin;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, 
        seeds = [ROLES_ADMIN_SEED.as_bytes()], 
        bump,  
        payer = admin, 
        space = DISCRIMINATOR_LEN + RolesAdmin::INIT_SPACE,
    )]
    pub roles_admin: Account<'info, RolesAdmin>,

    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_initialize(ctx: Context<Initialize>) -> Result<()> {
    let role = &mut ctx.accounts.roles_admin;
    role.account = ctx.accounts.admin.key();

    Ok(())
}
