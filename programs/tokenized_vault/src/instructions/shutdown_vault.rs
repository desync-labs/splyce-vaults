use anchor_lang::prelude::*;

use crate::constants::ROLES_SEED;
use crate::error::ErrorCode;
use crate::state::*;

#[derive(Accounts)]
pub struct ShutdownVault<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,
    #[account(seeds = [ROLES_SEED.as_bytes()], bump)]
    pub roles: Account<'info, Roles>,
    #[account(mut, address = roles.vaults_admin)]
    pub admin: Signer<'info>,
}

pub fn handle_shutdown_vault(ctx: Context<ShutdownVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;

    if vault.is_shutdown == true {
        return Err(ErrorCode::VaultShutdown.into());
    }

    vault.shutdown();

    Ok(())
}
