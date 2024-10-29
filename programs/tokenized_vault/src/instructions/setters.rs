use anchor_lang::prelude::*;

use crate::events::VaultUpdateDepositLimitEvent;
use crate::constants::ROLES_SEED;
use crate::error::ErrorCode;
use crate::state::{AccountRoles, Vault};

#[derive(Accounts)]
pub struct SetDepositLimit<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,
    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Account<'info, AccountRoles>,
    #[account(mut, constraint = roles.is_vaults_admin @ErrorCode::AccessDenied)]
    pub signer: Signer<'info>,
}

pub fn handle_set_deposit_limit(ctx: Context<SetDepositLimit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;

    if vault.is_shutdown == true {
        return Err(ErrorCode::VaultShutdown.into());
    }

    vault.deposit_limit = amount;

    emit!(VaultUpdateDepositLimitEvent {
        vault_index: vault.index_buffer,
        new_limit: amount,
    });

    Ok(())
}
