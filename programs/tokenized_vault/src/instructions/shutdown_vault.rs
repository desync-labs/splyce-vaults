use anchor_lang::prelude::*;
use access_control::{
    constants::ROLES_SEED,
    program::AccessControl,
    state::AccountRoles
};

use crate::error::ErrorCode;
use crate::state::Vault;

#[derive(Accounts)]
pub struct ShutdownVault<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,
    
    #[account(
        seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], 
        bump,
        seeds::program = access_control.key()
    )]
    pub roles: Account<'info, AccountRoles>,

    #[account(mut, constraint = roles.only_vaults_admin()?)]
    pub signer: Signer<'info>,

    pub access_control: Program<'info, AccessControl>
}

pub fn handle_shutdown_vault(ctx: Context<ShutdownVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;

    if vault.is_shutdown == true {
        return Err(ErrorCode::VaultShutdown.into());
    }

    vault.shutdown();

    Ok(())
}
