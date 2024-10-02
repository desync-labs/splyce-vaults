use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::error::ErrorCode;
use crate::utils::token::transfer_token_to;
use crate::utils::strategy;
use crate::constants::UNDERLYING_SEED;

#[derive(Accounts)]
pub struct Deposit<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,
    #[account()]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), strategy.key().as_ref()], bump)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_deposit<'info>(
    ctx: Context<Deposit<'info>>,
    amount: u64,
) -> Result<()> {
    let mut strategy = strategy::from_acc_info(&ctx.accounts.strategy)?;

    if *ctx.accounts.signer.key != strategy.vault() {
        return Err(ErrorCode::AccessDenied.into());
    }

    let max_deposit = strategy.available_deposit();

    if amount > max_deposit {
        return Err(ErrorCode::MaxDepositReached.into());
    }

    transfer_token_to(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.vault_token_account.to_account_info(), 
        ctx.accounts.token_account.to_account_info(), 
        ctx.accounts.signer.to_account_info(), 
        amount
    )?;

    strategy.deposit(amount)?;

    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])
}