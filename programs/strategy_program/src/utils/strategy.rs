use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::ErrorCode;

pub fn from_acc_info(strategy_acc: &UncheckedAccount) -> Result<Box<dyn Strategy>> {
    let strategy_data = strategy_acc.try_borrow_data()?;
    let discriminator = get_discriminator(strategy_acc)?;

    match StrategyType::from_discriminator(&discriminator) {
        Some(StrategyType::Simple) => {
            let strategy = SimpleStrategy::try_from_slice(&strategy_data[8..])
                .map_err(|_| ErrorCode::InvalidStrategyData)?;
            Ok(Box::new(strategy))
        }
        Some(StrategyType::TradeFintech) => {
            let strategy = TradeFintechStrategy::try_from_slice(&strategy_data[8..])
                .map_err(|_| ErrorCode::InvalidStrategyData)?;
            Ok(Box::new(strategy))
        }
        _ => {
            msg!("Invalid discriminator");
            Err(ErrorCode::InvalidStrategyData.into())
        }
    }
}

pub fn save_changes<T>(strategy_acc: &UncheckedAccount, strategy: Box<T>) -> Result<()> 
where
    T: Strategy + AnchorSerialize
{
    let mut strategy_data = strategy_acc.try_borrow_mut_data()?;
    strategy.serialize(&mut &mut strategy_data[8..])?;
    Ok(())
}

fn get_discriminator(acc_info: &UncheckedAccount) -> Result<[u8; 8]> {
    let data = acc_info.try_borrow_data()?;
    let discriminator = data[0..8].try_into().map_err(|_| ErrorCode::InvalidStrategyData)?;
    Ok(discriminator)
}