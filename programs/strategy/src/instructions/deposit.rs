use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Deposit<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: AccountInfo<'info>,
}

pub fn deposit<'info, T>(
    ctx: &Context<Deposit<'info>>,
    amount: u64,
) -> Result<()>
where
    T: Strategy + anchor_lang::AnchorDeserialize + anchor_lang::AnchorSerialize,
{
    let strategy_acc = &ctx.accounts.strategy;
    let mut strategy_data = strategy_acc.try_borrow_mut_data()?;
    let mut strategy: T = T::try_from_slice(&strategy_data[8..])
        .map_err(|_| ErrorCode::InvalidStrategyData)?;

    strategy.deposit(amount)?;
    // serialize strategy back to account
    strategy.serialize(&mut &mut strategy_data[8..])?;

    Ok(())
}