use anchor_lang::prelude::*;

use crate::state::*;
use crate::constants::*;

#[derive(Accounts)]
pub struct AddStrategy<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: is this a right way to do it?
    #[account()]
    pub strategy: AccountInfo<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_add_strategy(ctx: Context<AddStrategy>, max_debt: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.add_strategy(ctx.accounts.strategy.key(), max_debt)
}