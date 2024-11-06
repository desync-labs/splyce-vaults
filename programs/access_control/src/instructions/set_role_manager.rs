use anchor_lang::prelude::*;
use num_traits::FromPrimitive;

use crate::constants::{ROLE_MANAGER_SEED, DISCRIMINATOR_LEN, CONFIG_SEED};
use crate::state::{RoleManager, Role, Config};
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(role_id: u64)]
pub struct SetRoleManager<'info> {
    #[account(
        init_if_needed, 
        seeds = [
            ROLE_MANAGER_SEED.as_bytes(),
            role_id.to_le_bytes().as_ref(),
        ], 
        bump,  
        payer = signer, 
        space = DISCRIMINATOR_LEN + RoleManager::INIT_SPACE,
    )]
    pub role_manager: Account<'info, RoleManager>,

    #[account(seeds = [CONFIG_SEED.as_bytes()], bump)]
    pub config: Account<'info, Config>,

    #[account(mut, address = config.owner)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_set_role_manager(ctx: Context<SetRoleManager>, role_id: u64, manager_role_id: u64) -> Result<()> {
    let role: Option<Role> = FromPrimitive::from_u64(role_id);
    let manager_role: Option<Role> = FromPrimitive::from_u64(manager_role_id);

    if  role == None || manager_role == None {
        return Err(ErrorCode::InvalidRoleId.into());
    }

    ctx.accounts.role_manager.manager_role_id = manager_role_id;
    Ok(())
}  