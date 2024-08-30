use anchor_lang::prelude::*;
use strategy_program::state::*;

use crate::error::ErrorCode::*;

pub fn get_max_withdraw(strategy_acc: &AccountInfo) -> Result<u64> {
    let strategy = deserialize(strategy_acc)?;
    Ok(strategy.available_withdraw())
}

pub fn get_max_deposit(strategy_acc: &AccountInfo) -> Result<u64> {
    let strategy = deserialize(strategy_acc)?;
    Ok(strategy.available_deposit())
}

pub fn get_total_assets(strategy_acc: &AccountInfo) -> Result<u64> {
    let strategy = deserialize(strategy_acc)?;
    Ok(strategy.total_assets())
}

pub fn get_token_account_key(strategy_acc: &AccountInfo) -> Result<Pubkey> {
    let strategy = deserialize(strategy_acc)?;
    Ok(strategy.token_account())
}

pub fn assess_share_of_unrealised_losses(
    strategy_acc: &AccountInfo,
    assets_needed: u64,
    strategy_current_debt: u64,
) -> Result<u64> {
    let strategy_assets = get_total_assets(strategy_acc)?;
    if strategy_assets >= strategy_current_debt || strategy_current_debt == 0 {
        return Ok(0);
    }

    let numerator = assets_needed * strategy_assets;
    let losses_user_share = assets_needed - numerator / strategy_current_debt;

    Ok(losses_user_share)
}

pub fn deserialize(strategy_acc: &AccountInfo) -> Result<Box<dyn Strategy>> {
    let strategy_data = strategy_acc.try_borrow_data()?;
    let discriminator = get_discriminator(strategy_acc)?;

    match StrategyType::from_discriminator(&discriminator) {
        Some(StrategyType::Simple) => {
            let strategy = SimpleStrategy::try_from_slice(&strategy_data[8..])
                .map_err(|_| InvalidStrategyData)?;
            Ok(Box::new(strategy))
        }
        Some(StrategyType::TradeFintech) => {
            let strategy = TradeFintechStrategy::try_from_slice(&strategy_data[8..])
                .map_err(|_| InvalidStrategyData)?;
            Ok(Box::new(strategy))
        }
        _ => {
            msg!("Invalid discriminator");
            Err(InvalidStrategyData.into())
        }
    }
}

fn get_discriminator(acc_info: &AccountInfo) -> Result<[u8; 8]> {
    let data = acc_info.try_borrow_data()?;
    let discriminator = data[0..8].try_into().map_err(|_| InvalidStrategyData)?;
    Ok(discriminator)
}