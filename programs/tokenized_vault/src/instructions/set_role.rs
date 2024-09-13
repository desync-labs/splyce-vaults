use anchor_lang::prelude::*;

use crate::constants::ROLES_SEED;
use crate::state::roles::*;

#[derive(Accounts)]
pub struct SetRole<'info> {
    #[account(
        mut,
        seeds = [ROLES_SEED.as_bytes()], 
        bump,  
    )]
    pub roles: Account<'info, Roles>,
    #[account(mut,address = roles.protocol_admin)]
    pub admin: Signer<'info>,
}

pub fn handle_set_role(ctx: Context<SetRole>, role: Role, key: Pubkey) -> Result<()> {
    let roles = &mut ctx.accounts.roles;
    roles.set_role(role, key)
}
