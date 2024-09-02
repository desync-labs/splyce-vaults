use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use borsh::de;

use crate::state::base_strategy;
use crate::error::ErrorCode;
use crate::utils::strategy;
use crate::utils::token;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: AccountInfo<'info>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw<'info>(
    ctx: &Context<Withdraw<'info>>,
    amount: u64,
) -> Result<()> {
    let mut strategy = strategy::from_acc_info(&ctx.accounts.strategy)?;

    strategy.withdraw(amount)?;
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])?;

    // retrieve seeds from strategy
    let seeds = strategy.seeds();

    token::transfer_token_from(
        ctx.accounts.token_program.to_account_info(), 
        ctx.accounts.token_account.to_account_info(), 
        ctx.accounts.vault_token_account.to_account_info(), 
        ctx.accounts.strategy.to_account_info(), 
        amount, 
        &seeds
    )
}