use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use strategy_program::program::StrategyProgram;
use strategy_program::{self};
use strategy_program::cpi::*;
use strategy_program::cpi::accounts::Deposit as DepositAccounts;

use crate::state::*;

#[derive(Accounts)]
pub struct AllocateToStrategy<'info> {
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
    ctx: Context<AllocateToStrategy>, 
    amount: u64,
) -> Result<()> {
    msg!("Allocating to strategy");
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.strategy_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            }, 
            &[&ctx.accounts.vault.seeds()]
        ), 
        amount)?;

    strategy_program::cpi::deposit_funds(
        CpiContext::new(
        ctx.accounts.strategy_program.to_account_info(), DepositAccounts {
            strategy: ctx.accounts.strategy.to_account_info(),
        }), 
        amount)?; 

    Ok(())
}