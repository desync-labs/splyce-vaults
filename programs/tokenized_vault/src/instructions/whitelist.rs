use anchor_lang::prelude::*;
use access_control::{
    constants::USER_ROLE_SEED,
    program::AccessControl,
    state::{UserRole, Role}
};

use crate::constants::WHITELISTED_SEED;
use crate::state::{Vault, Whitelisted};

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct Whitelist<'info> {
    #[account(
        init, 
        seeds = [
            WHITELISTED_SEED.as_bytes(), 
            vault.key().as_ref(), 
            user.as_ref()
        ], 
        bump,  
        payer = signer, 
        space = Whitelisted::LEN,
    )]
    pub whitelisted: Account<'info, Whitelisted>,

    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,

    #[account(
        seeds = [
            USER_ROLE_SEED.as_bytes(), 
            signer.key().as_ref(),
            Role::VaultsAdmin.to_seed().as_ref()
        ], 
        bump,
        seeds::program = access_control.key()
    )]
    pub roles: Account<'info, UserRole>,

    #[account(mut, constraint = roles.check_role()?)]
    pub signer: Signer<'info>,
    
    pub access_control: Program<'info, AccessControl>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}


pub fn handle_whitelist(ctx: Context<Whitelist>, _user: Pubkey) -> Result<()> {
    ctx.accounts.whitelisted.is_whitelisted = true;
    Ok(())
}
