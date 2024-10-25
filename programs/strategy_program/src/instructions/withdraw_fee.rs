use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::error::ErrorCode;
use crate::utils::strategy;
use crate::utils::token;
use crate::constants::UNDERLYING_SEED;

use super::FreeFunds;

#[derive(Accounts)]
pub struct WithdrawFee<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,
    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), strategy.key().as_ref()], bump)]
    pub underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub recipient: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw_fee<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawFee<'info>>,
    amount: u64,
) -> Result<()> {
    let mut strategy = strategy::from_unchecked(&ctx.accounts.strategy)?;
    let fee_data = strategy.fee_data();

    if *ctx.accounts.signer.key != fee_data.fee_manager() {
        return Err(ErrorCode::AccessDenied.into());
    }

    if amount > fee_data.fee_balance {
        return Err(ErrorCode::InsufficientFunds.into());
    }

    let balance = ctx.accounts.underlying_token_account.amount;

    if amount > balance {
        let free_funds = &mut FreeFunds {
            strategy: ctx.accounts.strategy.clone(),
            underlying_token_account: ctx.accounts.underlying_token_account.clone(),
            signer: ctx.accounts.signer.clone(),
            token_program: ctx.accounts.token_program.clone(),
        };
        strategy.free_funds(free_funds, &ctx.remaining_accounts, amount - balance)?;
    }

    strategy.withdraw_fees(amount)?;
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])?;

    token::transfer_token_from(
        ctx.accounts.token_program.to_account_info(), 
        ctx.accounts.underlying_token_account.to_account_info(), 
        ctx.accounts.recipient.to_account_info(), 
        ctx.accounts.strategy.to_account_info(), 
        amount, 
        &strategy.seeds()
    )
}