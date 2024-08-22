use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, MintTo, Token, TokenAccount, Transfer},
};

use crate::state::*;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub strategy: Account<'info, SimpleStrategy>,
}

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    // Calculate shares to mint
    let mut strategy = &mut ctx.accounts.strategy;
    strategy.total_funds += amount;

    Ok(())
}
