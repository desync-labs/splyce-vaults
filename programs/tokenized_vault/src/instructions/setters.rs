use anchor_lang::prelude::*;

use crate::{events::VaultUpdateDepositLimitEvent, state::*};
use crate::constants::ROLES_SEED;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct SetDepositLimit<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,
    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Account<'info, AccountRoles>,
    #[account(mut, constraint = roles.is_vaults_admin)]
    pub signer: Signer<'info>,
}

pub fn handle_set_deposit_limit(ctx: Context<SetDepositLimit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;

    if vault.is_shutdown == true {
        return Err(ErrorCode::VaultShutdown.into());
    }

    vault.deposit_limit = amount;

    emit!(VaultUpdateDepositLimitEvent {
        vault_key: vault.key,
        new_limit: amount,
    });

    Ok(())
}
