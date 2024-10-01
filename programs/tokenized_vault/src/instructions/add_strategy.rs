use anchor_lang::prelude::*;

use crate::state::*;
use crate::constants::ROLES_SEED;

#[derive(Accounts)]
pub struct AddStrategy<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,

    /// CHECK: can be any strategy
    #[account()]
    pub strategy: UncheckedAccount<'info>,

    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Account<'info, AccountRoles>,
    
    #[account(mut, constraint = roles.is_vaults_admin)]
    pub signer: Signer<'info>,
}

pub fn handle_add_strategy(ctx: Context<AddStrategy>, max_debt: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;

    vault.add_strategy(ctx.accounts.strategy.key(), max_debt)
}