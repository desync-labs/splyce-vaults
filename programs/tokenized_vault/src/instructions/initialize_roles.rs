use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

use crate::constants::ROLES_SEED;
use crate::state::roles::*;

#[derive(Accounts)]
pub struct InitializeRoles<'info> {
    // TODO: need to think about proper seeds
    #[account(
        init, 
        seeds = [ROLES_SEED.as_bytes()], 
        bump,  
        payer = admin, 
        space = Roles::LEN,
    )]
    pub roles_data: Account<'info, Roles>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_init_roles(ctx: Context<InitializeRoles>) -> Result<()> {
    let roles = &mut ctx.accounts.roles_data;
    roles.set_role(Role::ProtocolAdmin, ctx.accounts.admin.key())
}
