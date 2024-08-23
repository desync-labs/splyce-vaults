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


// todo: consider pass
pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    // Calculate shares to mint
    let strategy_acc = &mut ctx.accounts.strategy;
    let mut strategy_data = strategy_acc.try_borrow_mut_data()?;
    let discriminator = &strategy_data[0..8];

    // todo: refactor this
    if discriminator == SimpleStrategy::discriminator() {
        let mut strategy: SimpleStrategy = SimpleStrategy::try_from_slice(&strategy_data[8..])
            .map_err(|_| ErrorCode::InvalidStrategyData)?;
        strategy.deposit(amount)?;
        strategy.serialize(&mut &mut strategy_data[8..])?;

    } else if discriminator == TradeFintechStrategy::discriminator() {
        let mut strategy: TradeFintechStrategy = TradeFintechStrategy::try_from_slice(&strategy_data[8..])
            .map_err(|_| ErrorCode::InvalidStrategyData)?;
        strategy.deposit(amount)?;
        strategy.serialize(&mut &mut strategy_data[8..])?;
    } else {
        msg!("Invalid discriminator");
        return Err(ErrorCode::InvalidStrategyData.into());
    }

    Ok(())
}
