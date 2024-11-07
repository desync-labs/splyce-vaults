use anchor_lang::prelude::*;
use num_traits::FromPrimitive;

use crate::constants::{DISCRIMINATOR_LEN, ROLE_MANAGER_SEED, USER_ROLE_SEED};
use crate::state::{Role, RoleManager, UserRole};
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(role_id: u64, user: Pubkey)]
pub struct SetRole<'info> {
    #[account(
        init_if_needed, 
        seeds = [
            USER_ROLE_SEED.as_bytes(),
            user.as_ref(),
            role_id.to_le_bytes().as_ref()
        ], 
        bump,  
        payer = signer, 
        space = DISCRIMINATOR_LEN + UserRole::INIT_SPACE,
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

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_set_role(ctx: Context<SetRole>, role_id: u64, _user: Pubkey) -> Result<()> {
    let role: Option<Role> = FromPrimitive::from_u64(role_id);
    if  role == None {
        return Err(ErrorCode::InvalidRoleId.into());
    }
    if role.unwrap() == Role::RolesAdmin {
        return Err(ErrorCode::CannotSetRoleAdmin.into());
    }

    let role_manager: Role = FromPrimitive::from_u64(ctx.accounts.role_manager.manager_role_id).unwrap();

    msg!("role_manager: {:?}", role_manager);
    ctx.accounts.roles.has_role = true;
    Ok(())
}  
