pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

pub use constants::*;
pub use instructions::*;
pub use state::*;
use error::ErrorCode::InvalidStrategyData;

declare_id!("J1GmVbeYEBzMMxv8oiuSCYSR4AjG6r6zKbK7sgSYDC5U");

#[program]
pub mod strategy {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, deposit_limit: u64) -> Result<()> {
        initialize::handler(ctx, deposit_limit)
    }

    pub fn deposit_funds(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let discriminator = get_discriminator(&ctx.accounts.strategy.to_account_info())?;
        
        match StrategyType::from_discriminator(&discriminator) {
            Some(StrategyType::Simple) => {
                return instructions::deposit::<SimpleStrategy>(&ctx, amount)
            }
            Some(StrategyType::TradeFintech) => {
                return instructions::deposit::<TradeFintechStrategy>(&ctx, amount)
            },
            _ => {
                msg!("Invalid discriminator");
                return Err(InvalidStrategyData.into())
            }
        }

        Ok(())
    }

    pub fn withdraw_funds(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let discriminator = get_discriminator(&ctx.accounts.strategy.to_account_info())?;
        
        match StrategyType::from_discriminator(&discriminator) {
            Some(StrategyType::Simple) => {
                return instructions::withdraw::<SimpleStrategy>(&ctx, amount)
            }
            Some(StrategyType::TradeFintech) => {
                return instructions::withdraw::<TradeFintechStrategy>(&ctx, amount)
            },
            _ => {
                msg!("Invalid discriminator");
                return Err(InvalidStrategyData.into())
            }
        }

        Ok(())
    }
}

fn get_discriminator(acc_info: &AccountInfo) -> Result<[u8; 8]> {
    let data = acc_info.try_borrow_data()?;
    let discriminator = data[0..8].try_into().map_err(|_| InvalidStrategyData)?;
    Ok(discriminator)
}