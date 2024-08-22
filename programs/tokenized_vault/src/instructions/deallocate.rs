use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Token, TokenAccount, Transfer},
};
use crate::{error::ErrorCode::InvalidAccountType, Deposit};
use crate::error::ErrorCode::InvalidStrategyConfig;
use strategy_program::state::SimpleStrategy;
use strategy_program::program::Strategy as StrategyProgram;
use strategy_program::{self};
use strategy_program::cpi::*;
use strategy_program::cpi::accounts::Withdraw as WithdrawAccounts;

use crate::state::*;

#[derive(Accounts)]
pub struct DeallocateFromStrategy<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    /// CHECK: Should this be mut?
    #[account(mut, constraint = vault.is_vault_strategy(strategy.key()))]
    pub strategy: AccountInfo<'info>,
    #[account(mut)]
    pub strategy_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub strategy_program: Program<'info, StrategyProgram>,
}

pub fn handler(
    ctx: Context<DeallocateFromStrategy>, 
    amount: u64,
) -> Result<()> {
    msg!("Deallocating funds from strategy");

    strategy_program::cpi::withdraw_funds(
        CpiContext::new(
        ctx.accounts.strategy_program.to_account_info(), WithdrawAccounts {
            strategy: ctx.accounts.strategy.to_account_info(),
            token_account: ctx.accounts.strategy_token_account.to_account_info(),
            vault_token_account: ctx.accounts.vault_token_account.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        }), 
        amount); 

    Ok(())
}
