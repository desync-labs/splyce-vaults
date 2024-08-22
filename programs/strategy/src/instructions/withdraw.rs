use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Burn, Mint, Token, TokenAccount, Transfer},
};

use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: AccountInfo<'info>,
    // #[account(mut)]
    // pub user: Signer<'info>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let mut strategyAcc = &mut ctx.accounts.strategy;
    let strategy_data = &mut strategyAcc.try_borrow_data()?;

    // todo: refactor this
    let mut strategy: SimpleStrategy = SimpleStrategy::try_from_slice(&strategy_data[8..])
        .map_err(|_| ErrorCode::InvalidStrategyData)?;

    msg!("current strategy funds: {:?}", strategy.total_funds);
    strategy.withdraw(amount);

    // Transfer tokens from strategy to vault
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: strategyAcc.to_account_info(),
            }, 
            &[&strategy.seeds()]
        ), 
        amount)?;
    
    Ok(())
}
