use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::ErrorCode;

// pub fn from_unchecked(strategy_acc: &UncheckedAccount) -> Result<Box<dyn Strategy>> {
//     let strategy_data = strategy_acc.try_borrow_data()?;
//     let discriminator = get_discriminator(strategy_acc)?;

//     match StrategyType::from_discriminator(&discriminator) {
//         Some(StrategyType::Simple) => {
//             let strategy = SimpleStrategy::try_from_slice(&strategy_data[8..])
//                 .map_err(|_| ErrorCode::InvalidStrategyData)?;
//             Ok(Box::new(strategy))
//         }
//         Some(StrategyType::TradeFintech) => {
//             let strategy = TradeFintechStrategy::try_from_slice(&strategy_data[8..])
//                 .map_err(|_| ErrorCode::InvalidStrategyData)?;
//             Ok(Box::new(strategy))
//         }
//         _ => {
//             msg!("Invalid discriminator");
//             Err(ErrorCode::InvalidStrategyData.into())
//         }
//     }
// }

// pub fn get_underlying_mint(strategy_acc: &UncheckedAccount) -> Pubkey {
//     let strategy = from_unchecked(strategy_acc).unwrap();
//     strategy.underlying_mint()
// }

// pub fn save_changes<T>(strategy_acc: &UncheckedAccount, strategy: Box<T>) -> Result<()> 
// where
//     T: Strategy + AnchorSerialize
// {
//     let mut strategy_data = strategy_acc.try_borrow_mut_data()?;
//     strategy.serialize(&mut &mut strategy_data[8..])?;
//     Ok(())
// }

// fn get_discriminator(acc_info: &UncheckedAccount) -> Result<[u8; 8]> {
//     let data = acc_info.try_borrow_data()?;
//     let discriminator = data[0..8].try_into().map_err(|_| ErrorCode::InvalidStrategyData)?;
//     Ok(discriminator)
// }

pub trait UncheckedStrategy {
    fn get_discriminator(&self) -> Result<[u8; 8]>;
    fn underlying_mint(&self) -> Pubkey;
    fn vault(&self) -> Pubkey;
    fn from_unchecked(&self) -> Result<Box<dyn Strategy>>;
    fn save_changes<T>(&self, strategy: Box<T>) -> Result<()> 
        where T: Strategy + AnchorSerialize;
}

impl<'a> UncheckedStrategy for UncheckedAccount<'a> {
    fn get_discriminator(&self) -> Result<[u8; 8]> {
        let data = self.try_borrow_data()?;
        let discriminator = data[0..8].try_into().map_err(|_| ErrorCode::InvalidStrategyData)?;
        Ok(discriminator)
    }
    fn underlying_mint(&self) -> Pubkey {
        let strategy = self.from_unchecked().unwrap();
        msg!("Strategy Underlying mint: {:?}", strategy.underlying_mint());
        strategy.underlying_mint()
    }

    fn vault(&self) -> Pubkey {
        let strategy = self.from_unchecked().unwrap();
        strategy.vault()
    }

    fn from_unchecked(&self) -> Result<Box<dyn Strategy>> {
        let strategy_data = self.try_borrow_data()?;
        let discriminator = self.get_discriminator()?;

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

    fn save_changes<T>(&self, strategy: Box<T>) -> Result<()> 
    where
        T: Strategy + AnchorSerialize
    {
        let mut strategy_data = self.try_borrow_mut_data()?;
        strategy.serialize(&mut &mut strategy_data[8..])?;
        Ok(())
    }
}