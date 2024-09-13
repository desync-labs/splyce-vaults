use anchor_lang::accounts::signer;
use anchor_lang::prelude::*;

use crate::state::*;
use crate::constants::ROLES_SEED;
use crate::error::ErrorCode;

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
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_add_strategy(ctx: Context<AddStrategy>, max_debt: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    vault.add_strategy(ctx.accounts.strategy.key(), max_debt)
}