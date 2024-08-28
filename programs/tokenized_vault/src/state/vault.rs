use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use anchor_spl::token_2022::spl_token_2022::solana_zk_token_sdk::instruction::withdraw;
use anchor_spl::token_interface::Mint;

use crate::constants::{VAULT_SEED, MAX_BPS};
use crate::error::ErrorCode;
use crate::utils::strategy;

#[account]
// #[repr(packed)]
#[derive(Default, Debug)]
pub struct Vault {
    pub bump: [u8; 1],
    pub index_buffer: [u8; 8],

    // /// Owner of the vault
    // pub owner: Pubkey,

    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    pub underlying_decimals: u8,

    pub total_debt: u64,
    pub total_shares: u64,
    pub minimum_total_idle: u64,
    pub total_idle: u64,
    pub deposit_limit: u64,
    pub min_user_deposit: u64,

    pub is_shutdown: bool,

    // pub strategies: [Pubkey; 10],
    pub strategies: [StrategyData; 10],
}

#[derive(AnchorDeserialize, AnchorSerialize, Default, Debug, Clone)]
pub struct StrategyData {
    pub key: Pubkey,
    pub current_debt: u64,
    pub max_debt: u64,
    pub last_update: i64,
    pub is_active: bool,
}


impl Vault {
    pub const LEN : usize = 8 + 1 + 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 10 * 32;
    pub fn seeds(&self) -> [&[u8]; 4] {
    [
        &VAULT_SEED.as_bytes(),
        self.underlying_mint.as_ref(),
        self.index_buffer.as_ref(),
        self.bump.as_ref(),
    ]}

    pub fn init(
        &mut self,
        bump: u8,
        underlying_mint: &InterfaceAccount<Mint>,
        underlying_token_acc: Pubkey,
        deposit_limit: u64,
        min_user_deposit: u64,
        index: u64,
    ) -> Result<()> {
        self.bump = [bump];
        self.underlying_mint = underlying_mint.key();
        self.underlying_token_acc = underlying_token_acc;
        self.underlying_decimals = underlying_mint.decimals;
        self.deposit_limit = deposit_limit;
        self.min_user_deposit = min_user_deposit;
        self.is_shutdown = false;
        self.total_debt = 0;
        self.total_shares = 0;
        self.index_buffer = index.to_le_bytes();
        Ok(())
    }

    pub fn shutdown(&mut self) {
        self.is_shutdown = true;
    }

    pub fn handle_deposit(&mut self, amount: u64, shares: u64) {
        self.total_idle += amount;
        self.total_shares += shares;
    }

    pub fn handle_withdraw(&mut self, amount: u64, shares: u64) {
        self.total_idle -= amount;
        self.total_shares -= shares;
    }

    pub fn max_deposit(&self) -> u64 {
        self.deposit_limit - self.total_funds()
    }

    pub fn max_withdraw(&self, shares: u64, strategies: &[AccountInfo], max_loss: u64) -> Result<u64> {
        let mut max_assets = self.convert_to_underlying(shares);

        if max_assets > self.total_idle {
            let mut have = self.total_idle;
            let mut loss = 0;

            for strategy_acc in strategies {
                let strategy_data = self.strategies.iter().find(|x| x.key == *strategy_acc.key).unwrap();
                if !strategy_data.is_active {
                    return Err(ErrorCode::InactiveStrategy.into());
                }

                let mut to_withdraw = std::cmp::min(max_assets - have, strategy_data.current_debt);
                let mut unrealised_loss = self.assess_share_of_unrealised_losses(strategy_acc, to_withdraw)?;
                let strategy_limit = strategy::get_max_withdraw(strategy_acc)?;

                if strategy_limit < to_withdraw - unrealised_loss {
                    let new_unrealised_loss = (unrealised_loss * strategy_limit) / to_withdraw;
                    unrealised_loss = new_unrealised_loss;
                    to_withdraw = strategy_limit + unrealised_loss;
                }

                if to_withdraw == 0 {
                    continue;
                }

                if unrealised_loss > 0 && max_loss < MAX_BPS {
                    if loss + unrealised_loss > ((have + to_withdraw) * max_loss) / MAX_BPS {
                        break;
                    }
                }

                have += to_withdraw;
                if have >= max_assets {
                    break;
                }

                loss += unrealised_loss;
            }
            max_assets = have;
        }

        Ok(max_assets)
    }

    pub fn convert_to_shares(&self, amount: u64) -> u64 {
        if self.total_shares == 0 {
            amount
        } else {
            (amount as u128 * self.total_shares as u128 / self.total_funds() as u128) as u64
        }
    }

    pub fn convert_to_underlying(&self, shares: u64) -> u64 {
        if self.total_shares == 0 {
            shares
        } else {
            (shares as u128 * self.total_funds() as u128 / self.total_shares as u128) as u64
        }
    }

    pub fn total_funds(&self) -> u64 {
        self.total_debt + self.total_idle
    }

    pub fn add_strategy(&mut self, strategy: Pubkey, max_debt: u64) -> Result<()> {
        let strategies_count = self.strategies.iter().filter(|&x| x.key != Pubkey::default()).count();
        if strategies_count == 10 {
            return Err(ErrorCode::StrategiesFull.into());
        }

        if self.is_vault_strategy(strategy) {
            return Err(ErrorCode::StrategyAlreadyAdded.into());
        }

        let strategy_data = StrategyData {
            key: strategy,
            current_debt: 0,
            max_debt,
            last_update: 0,
            is_active: true,
        };

        let pos = self.strategies.iter().position(|x| x.key == Pubkey::default()).unwrap();
        self.strategies[pos] = strategy_data;

        Ok(())
    }

    pub fn remove_strategy(&mut self, strategy: Pubkey) -> Result<()> {
        if let Some(pos) = self.strategies.iter().position(|x| x.key == strategy) {
            self.strategies[pos] = StrategyData::default();
            Ok(())
        } else {
            Err(ErrorCode::StrategyNotFound.into())
        }
    }

    pub fn set_current_debt(&mut self, strategy: Pubkey, debt: u64) -> Result<()> {
        let strategy_data = self.strategies.iter_mut().find(|x| x.key == strategy).unwrap();
        strategy_data.current_debt = debt;
        Ok(())
    }

    pub fn assess_share_of_unrealised_losses(
        &self, 
        strategy: &AccountInfo, 
        assets_needed: u64
    ) -> Result<u64> {

        let strategy_assets = strategy::get_total_assets(&strategy)?;
        let strategy_current_debt = self.strategies.iter().find(|x| x.key == *strategy.key).unwrap().current_debt;

        if strategy_assets >= strategy_current_debt || strategy_current_debt == 0 {
            return Ok(0);
        }

        let numerator = assets_needed * strategy_assets;
        let losses_user_share = assets_needed - numerator / strategy_current_debt;

        Ok(losses_user_share)
    }

    pub fn is_vault_strategy(&self, strategy: Pubkey) -> bool {
        self.strategies.iter().any(|x| x.key == strategy)
    }

    pub fn get_strategy_data(&self, strategy: Pubkey) -> Result<&StrategyData> {
        self.strategies.iter().find(|x| x.key == strategy).ok_or(ErrorCode::StrategyNotFound.into())
    }
}