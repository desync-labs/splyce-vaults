use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::error::ErrorCode;
use crate::utils::strategy;
use crate::utils::token;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account()]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw<'info>(
    ctx: Context<Withdraw<'info>>,
    amount: u64,
) -> Result<()> {
    let mut strategy = strategy::from_acc_info(&ctx.accounts.strategy)?;

    if *ctx.accounts.signer.key != strategy.vault() {
        return Err(ErrorCode::AccessDenied.into());
    }

    if amount > strategy.available_withdraw() {
        return Err(ErrorCode::InsufficientFunds.into());
    }

    let balance = ctx.accounts.token_account.amount;
    if amount > balance {
        strategy.free_funds(&ctx.remaining_accounts, amount - balance)?;
    }

    strategy.withdraw(amount)?;
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])?;

    token::transfer_token_from(
        ctx.accounts.token_program.to_account_info(), 
        ctx.accounts.token_account.to_account_info(), 
        ctx.accounts.vault_token_account.to_account_info(), 
        ctx.accounts.strategy.to_account_info(), 
        amount, 
        &strategy.seeds()
    )
}