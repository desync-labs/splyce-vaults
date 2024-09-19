use anchor_lang::prelude::*;

use crate::state::*;
use crate::constants::ROLES_SEED;

#[derive(Accounts)]
pub struct AddStrategy<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: is this a right way to do it?
    #[account()]
    pub strategy: AccountInfo<'info>,
    #[account(seeds = [ROLES_SEED.as_bytes()], bump)]
    pub roles: Account<'info, Roles>,
    #[account(mut, address = roles.vaults_admin)]
    pub admin: Signer<'info>,
}

pub fn handle_add_strategy(ctx: Context<AddStrategy>, max_debt: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    vault.add_strategy(ctx.accounts.strategy.key(), max_debt)
}