use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::state::*;
use crate::error::ErrorCode;
use crate::utils::token::transfer_token_to;
use crate::utils::strategy;

#[derive(Accounts)]
pub struct Deposit<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: AccountInfo<'info>,
    #[account(mut)]
    pub vault: Signer<'info>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_deposit<'info>(
    ctx: &Context<Deposit<'info>>,
    amount: u64,
) -> Result<()> {
    let mut strategy = strategy::from_acc_info(&ctx.accounts.strategy)?;

    strategy.deposit(amount)?;
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])?;

    transfer_token_to(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.vault_token_account.to_account_info(), 
        ctx.accounts.token_account.to_account_info(), 
        ctx.accounts.vault.to_account_info(), 
        amount
    )
}