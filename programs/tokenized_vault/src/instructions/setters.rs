use anchor_lang::prelude::*;

use crate::{events::VaultUpdateDepositLimitEvent, state::*};

#[derive(Accounts)]
pub struct SetDepositLimit<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

pub fn handle_set_deposit_limit(ctx: Context<SetDepositLimit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.deposit_limit = amount;

    emit!(VaultUpdateDepositLimitEvent {
        vault_index: vault.index_buffer,
        new_limit: amount,
    });

    Ok(())
}
