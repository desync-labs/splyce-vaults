use anchor_lang::prelude::*;
use access_control::{
    constants::USER_ROLE_SEED,
    program::AccessControl,
    state::{UserRole, Role}
};

use crate::events::VaultUpdateDepositLimitEvent;
use crate::errors::ErrorCode;
use crate::state::Vault;

#[derive(Accounts)]
pub struct SetDepositLimit<'info> {
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

    pub access_control: Program<'info, AccessControl>
}

pub fn handle_set_deposit_limit(ctx: Context<SetDepositLimit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;

    if vault.is_shutdown {
        return Err(ErrorCode::VaultShutdown.into());
    }

    vault.deposit_limit = amount;

    emit!(VaultUpdateDepositLimitEvent {
        vault_key: vault.key,
        new_limit: amount,
    });

    Ok(())
}
