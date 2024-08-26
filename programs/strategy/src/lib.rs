pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;
use error::ErrorCode::InvalidStrategyData;

declare_id!("FdFSegudTdDtCB8QvUN1FVLe6YpcCCLu5e1aJoiqAdtZ");

// we need to define a trait for the strategies
// they aren't defined otherwise, because we work with unchecked accounts
#[derive(Accounts)]
#[instruction(strategy_type: StrategyType)]pub struct RegAcc<'info> {
    #[account(mut)]
    pub strategy: Account<'info, SimpleStrategy>,
   
}


#[program]
pub mod strategy_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, strategy_type: StrategyType, config: Vec<u8>) -> Result<()> {
        match strategy_type {
            StrategyType::Simple => {
                return instructions::initialize::<SimpleStrategy>(ctx, config)
            }
            StrategyType::TradeFintech => {
                return instructions::initialize::<TradeFintechStrategy>(ctx, config)
            }
            _ => {
                msg!("Invalid strategy type");
                return Err(InvalidStrategyData.into())
            }
        }
    }

    pub fn register_accounts(ctx: Context<RegAcc>) -> Result<()> {
        Ok(())
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
        // Ok(())
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

        // Ok(())
    }
}

fn get_discriminator(acc_info: &AccountInfo) -> Result<[u8; 8]> {
    let data = acc_info.try_borrow_data()?;
    let discriminator = data[0..8].try_into().map_err(|_| InvalidStrategyData)?;
    Ok(discriminator)
}