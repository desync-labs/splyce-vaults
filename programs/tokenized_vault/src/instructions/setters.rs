use anchor_lang::prelude::*;
use access_control::{
    constants::ROLES_SEED,
    program::AccessControl,
    state::AccountRoles
};

use crate::events::VaultUpdateDepositLimitEvent;
use crate::errors::ErrorCode;
use crate::state::Vault;

#[derive(Accounts)]
pub struct SetDepositLimit<'info> {
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
