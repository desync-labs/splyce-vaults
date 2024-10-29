use anchor_lang::prelude::*;

use crate::constants::ROLES_SEED;
use crate::error::ErrorCode;
use crate::state::{AccountRoles, Vault};

#[derive(Accounts)]
pub struct ShutdownVault<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,
    
    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Account<'info, AccountRoles>,

    #[account(mut, constraint = roles.is_vaults_admin @ErrorCode::AccessDenied)]
    pub signer: Signer<'info>,
}

pub fn handle_shutdown_vault(ctx: Context<ShutdownVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;

    if vault.is_shutdown == true {
        return Err(ErrorCode::VaultShutdown.into());
    }

    vault.shutdown();

    Ok(())
}
