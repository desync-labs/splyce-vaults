use anchor_lang::prelude::*;

use crate::constants::ROLES_SEED;
use crate::error::ErrorCode;
use crate::state::{AccountRoles, Vault};

#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(mut, close = recipient)]
    pub vault: AccountLoader<'info, Vault>,
    
    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Account<'info, AccountRoles>,

    #[account(mut, constraint = roles.is_vaults_admin @ErrorCode::AccessDenied)]
    pub signer: Signer<'info>,

    /// CHECK:
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
}

pub fn handle_close_vault(ctx: Context<CloseVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;

    if !vault.is_shutdown {
        return Err(ErrorCode::VaultActive.into());
    }

    if vault.total_debt > 0 {
        return Err(ErrorCode::VaultHasDebt.into());
    }

    Ok(())
}
