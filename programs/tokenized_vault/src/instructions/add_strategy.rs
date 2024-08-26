use anchor_lang::prelude::*;

use crate::state::*;

#[derive(Accounts)]
pub struct AddStrategy<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: is this a right way to do it?
    #[account()]
    pub strategy: AccountInfo<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

pub fn handle_add_strategy(ctx: Context<AddStrategy>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let _ = vault.add_strategy(ctx.accounts.strategy.key());
    Ok(())
}