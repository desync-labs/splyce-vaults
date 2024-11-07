use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::constants::{VAULT_SEED, MAX_BPS, SHARES_SEED, MAX_BPS_EXTENDED};
use crate::errors::ErrorCode;
use crate::utils::strategy;
use crate::events::VaultAddStrategyEvent;


#[account(zero_copy(unsafe))]
#[repr(packed)]
#[derive(Default, Debug, InitSpace)]
pub struct Vault {
    pub bump: [u8; 1],
    pub index_buffer: [u8; 8],
    pub shares_bump: [u8; 1],

    pub key: Pubkey,

    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    pub underlying_decimals: u8,

    pub accountant: Pubkey,

    pub total_debt: u64,
    pub total_shares: u64,
    pub minimum_total_idle: u64,
    pub total_idle: u64,
    pub deposit_limit: u64,
    pub min_user_deposit: u64,

    pub is_shutdown: bool,

    // only kyc verified users can deposit
    pub kyc_verified_only: bool,

    pub profit_max_unlock_time: u64,
    pub full_profit_unlock_date: u64,
    pub profit_unlocking_rate: u64,
    pub last_profit_update: u64,

    pub strategies: [StrategyData; 10],
}

#[zero_copy(unsafe)]
#[repr(packed)]
#[derive(Default, Debug, PartialEq, Eq, InitSpace)]
pub struct StrategyData {
    pub key: Pubkey,
    pub current_debt: u64,
    pub max_debt: u64,
    pub last_update: i64,
    pub is_active: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct VaultConfig {
    pub deposit_limit: u64,
    pub min_user_deposit: u64,
    pub accountant: Pubkey,
    pub profit_max_unlock_time: u64,
    pub kyc_verified_only: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SharesConfig {
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

impl Vault {
    pub fn seeds(&self) -> [&[u8]; 3] {
    [
        &VAULT_SEED.as_bytes(),
        self.index_buffer.as_ref(),
        self.bump.as_ref(),
    ]}

    pub fn seeds_shares(&self) -> [&[u8]; 3] {
        [
            &SHARES_SEED.as_bytes(),
            self.key.as_ref(),
            self.shares_bump.as_ref(),
        ]
    }

    pub fn init(
        &mut self,
        index: u64,
        bump: u8,
        pubkey: Pubkey,
        underlying_mint: &InterfaceAccount<Mint>,
        underlying_token_acc: Pubkey,
        config: &VaultConfig
    ) -> Result<()> {
        self.index_buffer = index.to_le_bytes();
        self.bump = [bump];
        self.key = pubkey;

        self.underlying_mint = underlying_mint.key();
        self.underlying_token_acc = underlying_token_acc;
        self.underlying_decimals = underlying_mint.decimals;

        self.accountant = config.accountant;
        self.deposit_limit = config.deposit_limit;
        self.min_user_deposit = config.min_user_deposit;
        self.profit_max_unlock_time = config.profit_max_unlock_time;
        self.kyc_verified_only = config.kyc_verified_only;

        self.is_shutdown = false;
        self.total_debt = 0;
        self.total_shares = 0;
        self.total_idle = 0;

        Ok(())
    }
    pub fn shutdown(&mut self) {
        self.is_shutdown = true;
        self.deposit_limit = 0;
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

    pub fn max_withdraw(&self, shares: u64, strategies: &Vec<AccountInfo<'_>>, max_loss: u64) -> Result<u64> {
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
                let mut unrealised_loss = strategy::assess_share_of_unrealised_losses(
                    strategy_acc, 
                    to_withdraw, 
                    strategy_data.current_debt
                )?;
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
        if self.total_shares() == 0 {
            amount
        } else {
            (amount as u128 * self.total_shares() as u128 / self.total_funds() as u128) as u64
        }
    } 

    pub fn convert_to_underlying(&self, shares: u64) -> u64 {
        if self.total_shares() == 0 {
            shares
        } else {
            (shares as u128 * self.total_funds() as u128 / self.total_shares() as u128) as u64
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

        emit!(VaultAddStrategyEvent {
            vault_key: self.key,
            strategy_key: strategy,
            current_debt: 0,
            max_debt,
            last_update: 0,
            is_active: true,
        });

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

    pub fn is_vault_strategy(&self, strategy: Pubkey) -> bool {
        self.strategies.iter().any(|x| x.key == strategy)
    }

    pub fn get_strategy_data(&self, strategy: Pubkey) -> Result<&StrategyData> {
        self.strategies.iter().find(|x| x.key == strategy).ok_or(ErrorCode::StrategyNotFound.into())
    }

    pub fn get_strategy_data_mut(&mut self, strategy: Pubkey) -> Result<&mut StrategyData> {
        self.strategies.iter_mut().find(|x| x.key == strategy).ok_or(ErrorCode::StrategyNotFound.into())
    }

    pub fn update_strategy_current_debt(&mut self, strategy: Pubkey, amount: u64) -> Result<()> {
        let strategy_data = self.get_strategy_data_mut(strategy)?;
        strategy_data.current_debt = amount;
        strategy_data.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn unlocked_shares(&self) -> Result<u64> {
        let curr_timestamp = Clock::get()?.unix_timestamp as u64;
        let mut curr_unlocked_shares = 0;

        if self.full_profit_unlock_date > curr_timestamp {
            curr_unlocked_shares = (self.profit_unlocking_rate * (curr_timestamp - self.last_profit_update)) / MAX_BPS_EXTENDED;
        } else if self.full_profit_unlock_date != 0 {
            curr_unlocked_shares = (self.profit_unlocking_rate * (self.full_profit_unlock_date - self.last_profit_update)) / MAX_BPS_EXTENDED;
        }

        Ok(curr_unlocked_shares)
    }

    pub fn total_shares(&self) -> u64 {
        self.total_shares - self.unlocked_shares().unwrap()
    }
}