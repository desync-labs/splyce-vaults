use anchor_lang::prelude::*;

use crate::constants::ROLES_SEED;
use crate::error::ErrorCode;
use crate::state::*;

#[derive(Accounts)]
pub struct SetDepositLimit<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(seeds = [ROLES_SEED.as_bytes()], bump)]
    pub roles: Account<'info, Roles>,
    #[account(mut, address = roles.vaults_admin)]
    pub admin: Signer<'info>,
}

pub fn handle_set_deposit_limit(ctx: Context<SetDepositLimit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    if vault.is_shutdown == true {
        return Err(ErrorCode::VaultShutdown.into());
    }

    vault.deposit_limit = amount;

    Ok(())
}
