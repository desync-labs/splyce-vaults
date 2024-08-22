use anchor_lang::prelude::*;
use core::num;

use crate::constants::*;
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

pub fn handler(ctx: Context<AddStrategy>) -> Result<()> {
    let mut vault = &mut ctx.accounts.vault;
    vault.add_strategy(ctx.accounts.strategy.key());
    
    Ok(())
}