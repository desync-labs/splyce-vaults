use anchor_lang::prelude::*;
use anchor_spl::{
    token::Token,
    token_interface::TokenAccount,
};

use crate::error::ErrorCode;
use crate::utils::token::transfer;
use crate::utils::unchecked_strategy::UncheckedStrategy;
use crate::constants::UNDERLYING_SEED;

#[derive(Accounts)]
pub struct Deposit<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,

    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), strategy.key().as_ref()], bump)]
    pub underlying_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(constraint = signer.key() == strategy.vault() @ErrorCode::AccessDenied)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_deposit<'info>(
    ctx: Context<Deposit<'info>>,
    amount: u64,
) -> Result<()> {
    let mut strategy = ctx.accounts.strategy.from_unchecked()?;

    let max_deposit = strategy.available_deposit();

    if amount > max_deposit {
        return Err(ErrorCode::MaxDepositReached.into());
    }

    transfer(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.vault_token_account.to_account_info(), 
        ctx.accounts.underlying_token_account.to_account_info(), 
        ctx.accounts.signer.to_account_info(), 
        amount
    )?;

    strategy.deposit(amount)?;
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])
}