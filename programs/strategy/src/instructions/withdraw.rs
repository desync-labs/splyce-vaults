use std::cell::Ref;

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_lang::Discriminator;

use crate::state::*;
use crate::error::ErrorCode;

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

pub fn withdraw<'info, T>(
    ctx: &Context<Withdraw<'info>>,
    amount: u64,
) -> Result<()>
where
    T: Strategy + anchor_lang::AnchorDeserialize + anchor_lang::AnchorSerialize,
{
    let strategy_acc = &ctx.accounts.strategy;
    let mut strategy_data = strategy_acc.try_borrow_mut_data()?;
    let mut strategy: T = T::try_from_slice(&strategy_data[8..])
        .map_err(|_| ErrorCode::InvalidStrategyData)?;

    strategy.withdraw(amount)?;
    // serialize strategy back to account
    strategy.serialize(&mut &mut strategy_data[8..])?;

    // drop mutable borrow of strategy_data
    drop(strategy_data);

    // retrieve seeds from strategy
    let seeds = strategy.seeds();
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: strategy_acc.to_account_info(),
            },
            &[&seeds]
        ),
        amount,
    )?;
    Ok(())
}