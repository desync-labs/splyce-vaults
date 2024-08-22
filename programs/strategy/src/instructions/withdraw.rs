use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Burn, Mint, Token, TokenAccount, Transfer},
};

use crate::state::*;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // #[account(mut)]
    // pub strategy: Account<'info, SimpleStrategy>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Transfer tokens from vault to user
    // token::transfer(
    //     CpiContext::new_with_signer(
    //         ctx.accounts.token_program.to_account_info(), 
    //         Transfer {
    //             from: ctx.accounts.token_account.to_account_info(),
    //             to: ctx.accounts.vault_token_account.to_account_info(),
    //             authority: ctx.accounts.strategy.to_account_info(),
    //         }, 
    //         &[&ctx.accounts.strategy.seeds()]
    //     ), 
    //     amount)?;

    // Update balances
    // let mut strategy = &mut ctx.accounts.strategy;
    // strategy.handle_withdraw(amount, shares);

    Ok(())
}
