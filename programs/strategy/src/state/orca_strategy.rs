use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use anchor_spl::token::TokenAccount;

use super::base_strategy::*;
use super::StrategyType;
use super::fee_data::*;
use crate::error::ErrorCode;
use crate::events::{StrategyDepositEvent, AMMStrategyInitEvent, StrategyWithdrawEvent, HarvestAndReportDTF, InvestTrackerSwapEvent};
use crate::instructions::{Report, ReportProfit, ReportLoss, DeployFunds, FreeFunds, Rebalance};
use crate::constants::{AMOUNT_SPECIFIED_IS_INPUT, REMAINING_ACCOUNTS_MIN, MAX_SQRT_PRICE_X64, MIN_SQRT_PRICE_X64, INVEST_TRACKER_SEED, NO_EXPLICIT_SQRT_PRICE_LIMIT, MAX_ASSIGNED_WEIGHT};
use crate::state::invest_tracker::*;
use crate::utils::{
    orca_swap_handler,
    get_token_balance,
    orca_utils::compute_asset_per_swap,
};

const ACCOUNTS_PER_SWAP: usize = 12;
const INVEST_TRACKER_OFFSET: usize = 10;

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct OrcaStrategy {
    /// Bump to identify PDA
    pub bump: [u8; 1],
    pub index_bytes: [u8; 8],

    /// vault
    pub vault: Pubkey,
    pub manager: Pubkey,
    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    pub underlying_decimals: u8,

    pub total_invested: u64,
    pub total_assets: u64, // In orca, this is not actual total assets but total asset value in underlying token units (total asset value)
    pub deposit_limit: u64, // Use it when testing beta version

    pub fee_data: FeeData,
}   

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct OrcaStrategyConfig {
    pub deposit_limit: u64,
    pub deposit_period_ends: i64,
    pub lock_period_ends: i64,
    pub performance_fee: u64,
    pub fee_manager: Pubkey,
}

#[error_code]
pub enum OrcaStrategyErrorCode {
    #[msg("Place Holder Error1")]
    Error1,
    #[msg("Not enough accounts")]
    NotEnoughAccounts,
    #[msg("Invalid account")]
    InvalidAccount,
    #[msg("Invalid underlying token account for the swap direction")]
    InvalidUnderlyingToken,
    #[msg("Math error")]
    MathError,
    #[msg("Total weight must equal MAX_ASSIGNED_WEIGHT")]
    InvalidTotalWeight,
    #[msg("Cannot rebalance with zero total asset value")]
    ZeroTotalAssetValue,
    #[msg("No underlying tokens obtained from sales during rebalance")]
    NoUnderlyingTokensObtained,
}

impl StrategyManagement for OrcaStrategy {
    fn manager(&self) -> Pubkey {
        self.manager
    }

    fn set_manager(&mut self, manager: Pubkey) -> Result<()> {
        self.manager = manager;
        Ok(())
    }
}

impl OrcaStrategy {
    fn verify_invest_tracker(
        &self,
        invest_tracker_account: &AccountInfo,
        asset_mint: Pubkey,
        strategy_key: Pubkey,
    ) -> Result<()> {
        let (expected_invest_tracker, _) = Pubkey::find_program_address(
            &[
                INVEST_TRACKER_SEED.as_bytes(),
                &asset_mint.to_bytes(),
                strategy_key.as_ref()
            ],
            &crate::ID
        );
        require!(expected_invest_tracker == invest_tracker_account.key(), ErrorCode::InvalidAccount);
        Ok(())
    }

    fn validate_weights(&self, remaining: &[AccountInfo], num_swaps: usize) -> Result<Vec<u16>> {
        let mut total_weight = 0u64;
        let mut weights = Vec::with_capacity(num_swaps);

        for i in 0..num_swaps {
            let invest_tracker_account = &remaining[i * ACCOUNTS_PER_SWAP + INVEST_TRACKER_OFFSET];
            let data = invest_tracker_account.try_borrow_data()?;
            let invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;
            
            weights.push(invest_tracker_data.assigned_weight);
            total_weight = total_weight
                .checked_add(invest_tracker_data.assigned_weight.into())
                .ok_or(OrcaStrategyErrorCode::MathError)?;
        }

        if total_weight != MAX_ASSIGNED_WEIGHT as u64 {
            return Err(OrcaStrategyErrorCode::InvalidTotalWeight.into());
        }

        Ok(weights)
    }
}

impl Strategy for OrcaStrategy {
    fn deposit(&mut self, amount: u64) -> Result<()> {
        self.total_assets += amount;

        emit!(
            StrategyDepositEvent 
            {
                account_key: self.key(),
                amount: amount,
                total_assets: self.total_assets,
            }
        );

        Ok(())
    }

    fn withdraw(&mut self, amount: u64) -> Result<()> {
        self.total_assets -= amount;

        emit!(
            StrategyWithdrawEvent 
            {
                account_key: self.key(),
                amount: amount,
                total_assets: self.total_assets,
            }
        );

        Ok(())
    }
    //There is no fees to withdraw for this strategy
    #[allow(unused_variables)]
    fn withdraw_fees(&mut self, amount: u64) -> Result<()> {
        Ok(())
    }

    #[allow(unused_variables)]
    fn report_profit<'info>(&mut self, accounts: &ReportProfit<'info>, remaining: &[AccountInfo<'info>], profit: u64) -> Result<()> {
        // Verify we have enough remaining accounts and that they come in pairs
        if remaining.len() < 2 || remaining.len() % 2 != 0 {
            return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        }

        self.report(
            &mut Report {
                strategy: accounts.strategy.clone(),
                underlying_token_account: accounts.underlying_token_account.clone(),
                token_program: accounts.token_program.clone(),
                signer: accounts.signer.clone(),
            },
            &remaining
        )?;

        Ok(())
    }

    #[allow(unused_variables)]
    fn report_loss<'info>(&mut self, accounts: &ReportLoss<'info>, remaining: &[AccountInfo<'info>], loss: u64) -> Result<()> {
        // Verify we have enough remaining accounts and that they come in pairs
        if remaining.len() < 2 || remaining.len() % 2 != 0 {
            return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        }

        self.report(
            &mut Report {
                strategy: accounts.strategy.clone(),
                underlying_token_account: accounts.underlying_token_account.clone(),
                token_program: accounts.token_program.clone(),
                signer: accounts.signer.clone(),
            },
            &remaining
        )?;

        Ok(())
    }

    #[allow(unused_variables)]
    fn harvest_and_report<'info>(&mut self, accounts: &Report<'info>, remaining: &[AccountInfo<'info>]) -> Result<u64> {
        if accounts.underlying_token_account.key() != self.underlying_token_acc {
            return Err(ErrorCode::InvalidAccount.into());
        }

        // Calculate total asset value from all invest tracker accounts
        let mut total_asset_value: u128 = 0;

        // Iterate through invest tracker accounts in pairs
        // Each pair consists of (invest_tracker, asset_mint_account)
        for chunk in remaining.chunks(2) {
            if chunk.len() != 2 {
                return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
            }

            let invest_tracker_info = &chunk[0];
            let asset_mint_info = &chunk[1];
            
            // Verify invest tracker PDA using the provided mint account
            self.verify_invest_tracker(
                invest_tracker_info,
                asset_mint_info.key(),
                accounts.strategy.key()
            )?;

            // Get invest tracker data
            let data = invest_tracker_info.try_borrow_data()?;
            let invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;
            
            // Verify that the mint in invest tracker matches the provided mint account
            require!(invest_tracker_data.asset_mint == asset_mint_info.key(), ErrorCode::InvalidAccount);

            // Add asset value to total
            total_asset_value = total_asset_value
                .checked_add(invest_tracker_data.asset_value)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
        }

        // Ensure total_asset_value fits in u64
        if total_asset_value > u64::MAX as u128 {
            return Err(OrcaStrategyErrorCode::MathError.into());
        }

        let new_total_assets = total_asset_value as u64;

        // Emit event with total assets and timestamp
        emit!(HarvestAndReportDTF {
            total_assets: new_total_assets as u128, //basically total asset value in USDC which is the underlying token
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(new_total_assets)
    }

    //Free fund swaps asset to underlying token
    //Make sure sales would happen based on the current weight from the invest tracker
    fn free_funds<'info>(&mut self, accounts: &FreeFunds<'info>, remaining: &[AccountInfo<'info>], amount: u64) -> Result<()> {
        // Calculate number of swaps based on remaining accounts length
        let num_swaps = remaining.len() / ACCOUNTS_PER_SWAP;
        if remaining.len() != num_swaps * ACCOUNTS_PER_SWAP {
            return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        }

        // First pass: Calculate total weight and store weights
        let mut total_weight = 0u64;
        let mut weights = Vec::with_capacity(num_swaps);
        let mut highest_weight_index = 0;

        for i in 0..num_swaps {
            let invest_tracker_account = &remaining[i * ACCOUNTS_PER_SWAP + INVEST_TRACKER_OFFSET];
            let data = invest_tracker_account.try_borrow_data()?;
            let invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;
            
            weights.push(invest_tracker_data.current_weight);
            if invest_tracker_data.current_weight > weights[highest_weight_index] {
                highest_weight_index = i;
            }
            total_weight = total_weight
                .checked_add(invest_tracker_data.current_weight.into())
                .ok_or(OrcaStrategyErrorCode::MathError)?;
        }

        // Verify total weight is less than or equal to MAX_ASSIGNED_WEIGHT
        if total_weight > MAX_ASSIGNED_WEIGHT as u64 {
            return Err(OrcaStrategyErrorCode::InvalidTotalWeight.into());
        }

        // Calculate amounts for each swap and track total
        let mut amounts = Vec::with_capacity(num_swaps);
        let mut total_allocated = 0u64;

        for i in 0..num_swaps {
            let amount_per_swap = if total_weight > 0 {
                (amount as u128)
                    .checked_mul(weights[i] as u128)
                    .ok_or(OrcaStrategyErrorCode::MathError)?
                    .checked_div(MAX_ASSIGNED_WEIGHT as u128)
                    .ok_or(OrcaStrategyErrorCode::MathError)? as u64
            } else {
                amount.checked_div(num_swaps as u64)
                    .ok_or(OrcaStrategyErrorCode::MathError)?
            };
            
            total_allocated = total_allocated
                .checked_add(amount_per_swap)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
            amounts.push(amount_per_swap);
        }

        // Adjust for rounding error by adding remainder to highest weight swap
        if total_allocated < amount {
            let remainder = amount
                .checked_sub(total_allocated)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
            amounts[highest_weight_index] = amounts[highest_weight_index]
                .checked_add(remainder)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
        }

        // Iterate through each swap operation using adjusted amounts
        for i in 0..num_swaps {
            let start = i * ACCOUNTS_PER_SWAP;
            let amount_per_swap = amounts[i];

            // Extract accounts from remaining array
            let whirlpool_program = &remaining[start];
            let whirlpool = &remaining[start + 1];
            let token_owner_account_a = &remaining[start + 2];
            let token_vault_a = &remaining[start + 3];
            let token_owner_account_b = &remaining[start + 4];
            let token_vault_b = &remaining[start + 5];
            let tick_array_0 = &remaining[start + 6];
            let tick_array_1 = &remaining[start + 7];
            let tick_array_2 = &remaining[start + 8];
            let oracle = &remaining[start + 9];
            let invest_tracker_account = &remaining[start + INVEST_TRACKER_OFFSET];

            // Get the invest tracker data and verify PDA in its own scope
            let (is_a_to_b, asset_mint) = {
                let data = invest_tracker_account.try_borrow_data()?;
                let invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;
                let is_a_to_b = invest_tracker_data.a_to_b_for_purchase;
                
                // Get asset mint in this scope
                let asset_account = if is_a_to_b {
                    token_owner_account_b
                } else {
                    token_owner_account_a
                };
                let asset_mint = {
                    let asset_account_data = asset_account.data.borrow();
                    let asset_token_account = TokenAccount::try_deserialize(&mut &asset_account_data[..])?;
                    asset_token_account.mint
                };
                
                (is_a_to_b, asset_mint)
            };

            // Verify invest tracker PDA
            self.verify_invest_tracker(
                invest_tracker_account,
                asset_mint,
                accounts.strategy.key()
            )?;

            // Validate underlying token account based on swap direction
            if is_a_to_b {
                if token_owner_account_a.key() != self.underlying_token_acc {
                    return Err(OrcaStrategyErrorCode::InvalidUnderlyingToken.into());
                }
            } else {
                if token_owner_account_b.key() != self.underlying_token_acc {
                    return Err(OrcaStrategyErrorCode::InvalidUnderlyingToken.into());
                }
            }

            // Get balances before swap
            let (underlying_balance_before_swap, asset_balance_before_swap) = {
                let underlying_balance = if is_a_to_b {
                    let data = token_owner_account_a.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                } else {
                    let data = token_owner_account_b.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                };

                let asset_balance = if is_a_to_b {
                    let data = token_owner_account_b.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                } else {
                    let data = token_owner_account_a.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                };

                (underlying_balance, asset_balance)
            };

            // Perform the swap
            orca_swap_handler(
                whirlpool_program,
                &accounts.token_program,
                &accounts.strategy,
                whirlpool,
                token_owner_account_a,
                token_vault_a,
                token_owner_account_b,
                token_vault_b,
                tick_array_0,
                tick_array_1,
                tick_array_2,
                oracle,
                &[&self.seeds()],
                amount_per_swap,    // Amount to swap
                u64::MAX,          // other_amount_threshold (no minimum for free_funds)
                if !is_a_to_b { MIN_SQRT_PRICE_X64 } else { MAX_SQRT_PRICE_X64 }, // sqrt_price_limit
                !AMOUNT_SPECIFIED_IS_INPUT,    // amount_specified_is_input
                !is_a_to_b,         // a_to_b (reversed for selling)
            )?;

            // Get balances after swap
            let (underlying_balance_after_swap, asset_balance_after_swap) = {
                let underlying_balance = if is_a_to_b {
                    let data = token_owner_account_a.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                } else {
                    let data = token_owner_account_b.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                };

                let asset_balance = if is_a_to_b {
                    let data = token_owner_account_b.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                } else {
                    let data = token_owner_account_a.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                };

                (underlying_balance, asset_balance)
            };

            // Update invest tracker data
            self.update_invest_tracker_after_swap(
                invest_tracker_account,
                underlying_balance_before_swap,
                underlying_balance_after_swap,
                asset_balance_before_swap,
                asset_balance_after_swap,
                false,
            )?;
        }

        Ok(())
    }

    fn deploy_funds<'info>(&mut self, accounts: &DeployFunds<'info>, remaining: &[AccountInfo<'info>], amount: u64) -> Result<()> {
        // Calculate number of swaps based on remaining accounts length
        let num_swaps = remaining.len() / ACCOUNTS_PER_SWAP;
        if remaining.len() != num_swaps * ACCOUNTS_PER_SWAP {
            return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        }

        // First pass: Calculate total weight and validate it equals MAX_ASSIGNED_WEIGHT
        let weights = self.validate_weights(remaining, num_swaps)?;

        // Iterate through each swap operation
        for i in 0..num_swaps {
            let start = i * ACCOUNTS_PER_SWAP;
            let amount_per_swap = compute_asset_per_swap(
                amount,
                weights[i] as u128,
                MAX_ASSIGNED_WEIGHT as u128
            );
            // Extract accounts from remaining array
            let whirlpool_program = &remaining[start];
            let whirlpool = &remaining[start + 1];
            let token_owner_account_a = &remaining[start + 2];
            let token_vault_a = &remaining[start + 3];
            let token_owner_account_b = &remaining[start + 4];
            let token_vault_b = &remaining[start + 5];
            let tick_array_0 = &remaining[start + 6];
            let tick_array_1 = &remaining[start + 7];
            let tick_array_2 = &remaining[start + 8];
            let oracle = &remaining[start + 9];
            let invest_tracker_account = &remaining[start + INVEST_TRACKER_OFFSET];

            // Get the invest tracker data in its own scope
            let (is_a_to_b, asset_mint) = {
                let mut data = invest_tracker_account.try_borrow_mut_data()?;
                let invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;
                let is_a_to_b = invest_tracker_data.a_to_b_for_purchase;
                
                // Get asset mint in this scope
                let asset_account = if is_a_to_b {
                    token_owner_account_b
                } else {
                    token_owner_account_a
                };
                let asset_mint = {
                    let asset_account_data = asset_account.data.borrow();
                    let asset_token_account = TokenAccount::try_deserialize(&mut &asset_account_data[..])?;
                    asset_token_account.mint
                };
                
                (is_a_to_b, asset_mint)
            };

            // Verify invest tracker PDA
            self.verify_invest_tracker(
                invest_tracker_account,
                asset_mint,
                accounts.strategy.key()
            )?;

            // Validate underlying token account based on swap direction
            if is_a_to_b {
                if token_owner_account_a.key() != self.underlying_token_acc {
                    return Err(OrcaStrategyErrorCode::InvalidUnderlyingToken.into());
                }
            } else {
                if token_owner_account_b.key() != self.underlying_token_acc {
                    return Err(OrcaStrategyErrorCode::InvalidUnderlyingToken.into());
                }
            }

            // Get balances before swap
            let (underlying_balance_before_swap, asset_balance_before_swap) = {
                let underlying_balance = if is_a_to_b {
                    let data = token_owner_account_a.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                } else {
                    let data = token_owner_account_b.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                };

                let asset_balance = if is_a_to_b {
                    let data = token_owner_account_b.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                } else {
                    let data = token_owner_account_a.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                };

                (underlying_balance, asset_balance)
            };

            // Perform the swap
            orca_swap_handler(
                whirlpool_program,
                &accounts.token_program,
                &accounts.strategy,
                whirlpool,
                token_owner_account_a,
                token_vault_a,
                token_owner_account_b,
                token_vault_b,
                tick_array_0,
                tick_array_1,
                tick_array_2,
                oracle,
                &[&self.seeds()],
                amount_per_swap,
                0,
                NO_EXPLICIT_SQRT_PRICE_LIMIT,
                AMOUNT_SPECIFIED_IS_INPUT,
                is_a_to_b,
            )?;

            // Get balances after swap and update invest tracker
            let (underlying_balance_after_swap, asset_balance_after_swap) = {
                let underlying_balance = if is_a_to_b {
                    let data = token_owner_account_a.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                } else {
                    let data = token_owner_account_b.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                };

                let asset_balance = if is_a_to_b {
                    let data = token_owner_account_b.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                } else {
                    let data = token_owner_account_a.data.borrow();
                    TokenAccount::try_deserialize(&mut &data[..])?.amount
                };

                (underlying_balance, asset_balance)
            };

            // Update invest tracker data
            self.update_invest_tracker_after_swap(
                invest_tracker_account,
                underlying_balance_before_swap,
                underlying_balance_after_swap,
                asset_balance_before_swap,
                asset_balance_after_swap,
                true,
            )?;
        }

        Ok(())
    }

    fn set_total_assets(&mut self, total_assets: u64) {
        self.total_assets = total_assets;
    }

    fn rebalance<'info>(&mut self, accounts: &Rebalance<'info>, remaining: &[AccountInfo<'info>], _amount: u64) -> Result<()> {
        // Calculate number of swaps based on remaining accounts length
        let num_swaps = remaining.len() / ACCOUNTS_PER_SWAP;
        if remaining.len() != num_swaps * ACCOUNTS_PER_SWAP {
            return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        }

        // First, collect InvestTracker data and total asset value
        let (mut invest_tracker_data_vec, total_asset_value) = self.collect_invest_tracker_data(remaining, num_swaps)?;

        if total_asset_value == 0 {
            return Err(OrcaStrategyErrorCode::ZeroTotalAssetValue.into());
        }

        // Determine assets to sell and buy
        let mut sell_list = Vec::new(); // (index, delta_value)
        let mut buy_list = Vec::new(); // (index, delta_value)

        for (i, invest_tracker_data) in invest_tracker_data_vec.iter().enumerate() {
            let assigned_weight = invest_tracker_data.assigned_weight as u128;
            let target_value = total_asset_value
                .checked_mul(assigned_weight)
                .ok_or(OrcaStrategyErrorCode::MathError)?
                .checked_div(MAX_ASSIGNED_WEIGHT as u128)
                .ok_or(OrcaStrategyErrorCode::MathError)?;

            let current_value = invest_tracker_data.asset_value;

            if current_value > target_value {
                let delta_value = current_value.checked_sub(target_value).ok_or(OrcaStrategyErrorCode::MathError)?;
                sell_list.push((i, delta_value)); // (index, delta_value)
            } else if current_value < target_value {
                let delta_value = target_value.checked_sub(current_value).ok_or(OrcaStrategyErrorCode::MathError)?;
                buy_list.push((i, delta_value)); // (index, delta_value)
            }
        }

        // Process selling assets first
        let mut total_underlying_obtained: u64 = 0;

        for (i, delta_value) in sell_list {
            let start = i * ACCOUNTS_PER_SWAP;
            let invest_tracker_account = &remaining[start + INVEST_TRACKER_OFFSET];
            let invest_tracker_data = &mut invest_tracker_data_vec[i];

            // Ensure delta_value fits into u64
            if delta_value > u64::MAX as u128 {
                return Err(OrcaStrategyErrorCode::MathError.into());
            }
            let amount_per_swap_u64 = delta_value as u64;

            // Ensure amount_per_swap_u64 is positive
            if amount_per_swap_u64 == 0 {
                continue;
            }

            // Extract accounts for this swap
            let whirlpool_program = &remaining[start];
            let whirlpool = &remaining[start + 1];
            let token_owner_account_a = &remaining[start + 2];
            let token_vault_a = &remaining[start + 3];
            let token_owner_account_b = &remaining[start + 4];
            let token_vault_b = &remaining[start + 5];
            let tick_array_0 = &remaining[start + 6];
            let tick_array_1 = &remaining[start + 7];
            let tick_array_2 = &remaining[start + 8];
            let oracle = &remaining[start + 9];

            let is_a_to_b = invest_tracker_data.a_to_b_for_purchase;

            // Get balances before swap
            let underlying_balance_before_swap = get_token_balance(if is_a_to_b { token_owner_account_a } else { token_owner_account_b })?;
            let asset_balance_before_swap = get_token_balance(if is_a_to_b { token_owner_account_b } else { token_owner_account_a })?;

            // Perform the swap
            orca_swap_handler(
                whirlpool_program,
                &accounts.token_program,
                &accounts.strategy,
                whirlpool,
                token_owner_account_a,
                token_vault_a,
                token_owner_account_b,
                token_vault_b,
                tick_array_0,
                tick_array_1,
                tick_array_2,
                oracle,
                &[&self.seeds()],
                amount_per_swap_u64,    // Amount of underlying tokens to receive
                u64::MAX,               // other_amount_threshold (no minimum for receiving)
                if !is_a_to_b { MIN_SQRT_PRICE_X64 } else { MAX_SQRT_PRICE_X64 }, // sqrt_price_limit
                !AMOUNT_SPECIFIED_IS_INPUT,    // amount_specified_is_input = false
                !is_a_to_b,             // a_to_b reversed for selling
            )?;

            // Get balances after swap
            let underlying_balance_after_swap = get_token_balance(if is_a_to_b { token_owner_account_a } else { token_owner_account_b })?;
            let asset_balance_after_swap = get_token_balance(if is_a_to_b { token_owner_account_b } else { token_owner_account_a })?;

            // Calculate underlying received
            let underlying_received = underlying_balance_after_swap.checked_sub(underlying_balance_before_swap)
                .ok_or(OrcaStrategyErrorCode::MathError)?;

            // Update invest tracker data
            self.update_invest_tracker_after_swap(
                invest_tracker_account,
                underlying_balance_before_swap,
                underlying_balance_after_swap,
                asset_balance_before_swap,
                asset_balance_after_swap,
                false,
            )?;

            total_underlying_obtained = total_underlying_obtained
                .checked_add(underlying_received)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
        }

        // Process buying assets with the underlying tokens obtained
        if total_underlying_obtained == 0 {
            return Err(OrcaStrategyErrorCode::NoUnderlyingTokensObtained.into());
        }

        // Calculate total delta_value for buys
        let total_buy_value: u128 = buy_list.iter().map(|&(_, delta_value)| delta_value).sum();

        for (i, delta_value) in buy_list {
            let start = i * ACCOUNTS_PER_SWAP;
            let invest_tracker_account = &remaining[start + INVEST_TRACKER_OFFSET];
            let invest_tracker_data = &mut invest_tracker_data_vec[i];

            // Calculate amount_per_swap_u64 proportionally
            let amount_per_swap_u64 = compute_asset_per_swap(
                total_underlying_obtained, 
                delta_value, 
                total_buy_value
            );

            // Ensure amount_per_swap_u64 is positive
            if amount_per_swap_u64 == 0 {
                continue;
            }

            // Extract accounts for this swap
            let whirlpool_program = &remaining[start];
            let whirlpool = &remaining[start + 1];
            let token_owner_account_a = &remaining[start + 2];
            let token_vault_a = &remaining[start + 3];
            let token_owner_account_b = &remaining[start + 4];
            let token_vault_b = &remaining[start + 5];
            let tick_array_0 = &remaining[start + 6];
            let tick_array_1 = &remaining[start + 7];
            let tick_array_2 = &remaining[start + 8];
            let oracle = &remaining[start + 9];

            let is_a_to_b = invest_tracker_data.a_to_b_for_purchase;

            // Get balances before swap
            let underlying_balance_before_swap = get_token_balance(if is_a_to_b { token_owner_account_a } else { token_owner_account_b })?;
            let asset_balance_before_swap = get_token_balance(if is_a_to_b { token_owner_account_b } else { token_owner_account_a })?;

            // Perform the swap
            orca_swap_handler(
                whirlpool_program,
                &accounts.token_program,
                &accounts.strategy,
                whirlpool,
                token_owner_account_a,
                token_vault_a,
                token_owner_account_b,
                token_vault_b,
                tick_array_0,
                tick_array_1,
                tick_array_2,
                oracle,
                &[&self.seeds()],
                amount_per_swap_u64,    // Amount of underlying tokens to spend
                0,                      // other_amount_threshold
                NO_EXPLICIT_SQRT_PRICE_LIMIT,
                AMOUNT_SPECIFIED_IS_INPUT,    // amount_specified_is_input = true
                is_a_to_b,             // a_to_b
            )?;

            // Get balances after swap
            let underlying_balance_after_swap = get_token_balance(if is_a_to_b { token_owner_account_a } else { token_owner_account_b })?;
            let asset_balance_after_swap = get_token_balance(if is_a_to_b { token_owner_account_b } else { token_owner_account_a })?;

            // Update invest tracker data
            self.update_invest_tracker_after_swap(
                invest_tracker_account,
                underlying_balance_before_swap,
                underlying_balance_after_swap,
                asset_balance_before_swap,
                asset_balance_after_swap,
                true,
            )?;
        }

        Ok(())
    }
}

impl StrategyGetters for OrcaStrategy {
    fn strategy_type(&self) -> StrategyType {
        StrategyType::Orca
    }

    fn underlying_mint(&self) -> Pubkey {
        self.underlying_mint
    }

    fn vault(&self) -> Pubkey {
        self.vault
    }

    fn token_account(&self) -> Pubkey {
        self.underlying_token_acc
    }

    fn total_assets(&self) -> u64 {
        self.total_assets
    }

    fn total_invested(&self) -> u64 {
        self.total_invested
    }

    fn available_deposit(&self) -> u64 {
        self.deposit_limit - self.total_assets
    }

    fn available_withdraw(&self) -> u64 {
        self.total_assets
    }

    fn fee_data(&mut self) -> &mut FeeData {
        &mut self.fee_data
    }
}

impl StrategyInit for OrcaStrategy {
    fn init(
        &mut self,
        bump: u8,
        index: u64,
        vault: Pubkey, 
        underlying_mint: &InterfaceAccount<Mint>, 
        underlying_token_acc: Pubkey, 
        config_bytes: Vec<u8>,
    ) -> Result<()> {
        let config: OrcaStrategyConfig = OrcaStrategyConfig::try_from_slice(&config_bytes)
        .map_err(|_| ErrorCode::InvalidStrategyConfig)?;

        self.bump = [bump];
        self.index_bytes = index.to_le_bytes();
        self.vault = vault;
        self.underlying_mint = underlying_mint.key();
        self.underlying_decimals = underlying_mint.decimals;
        self.underlying_token_acc = underlying_token_acc;
        self.deposit_limit = config.deposit_limit;
        self.total_assets = 0;
        self.total_invested = 0;

        self.fee_data = FeeData {
            fee_manager: config.fee_manager,
            performance_fee: config.performance_fee,
            fee_balance: 0,
        };

        emit!(
            AMMStrategyInitEvent 
            {
                account_key: self.key(),
                strategy_type: String::from("trade-fintech"),
                vault: self.vault,
                underlying_mint: self.underlying_mint,
                underlying_token_acc: self.underlying_token_acc,
                undelying_decimals: self.underlying_decimals,
                deposit_limit: self.deposit_limit,
            });

        Ok(())
    }
}

impl StrategyDataAccount for OrcaStrategy {
    fn save_changes(&self, writer: &mut dyn std::io::Write) -> Result<()> {
        self.try_to_vec().map_err(|_| ErrorCode::SerializationError.into()).and_then(|vec| {
            writer.write_all(&vec).map_err(|_| ErrorCode::SerializationError.into())
        })
    }
    
    fn seeds(&self) -> [&[u8]; 3] {
        [
            self.vault.as_ref(),
            self.index_bytes.as_ref(),
            self.bump.as_ref(),
        ]
    }
}

impl OrcaStrategy {
    // Helper functions for rebalance
    fn collect_invest_tracker_data(
        &self,
        remaining: &[AccountInfo],
        num_swaps: usize,
    ) -> Result<(Vec<InvestTracker>, u128)> {
        let mut total_asset_value: u128 = 0;
        let mut invest_tracker_data_vec = Vec::with_capacity(num_swaps);

        for i in 0..num_swaps {
            let start = i * ACCOUNTS_PER_SWAP;
            let invest_tracker_account = &remaining[start + INVEST_TRACKER_OFFSET];

            let data = invest_tracker_account.try_borrow_data()?;
            let invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;

            total_asset_value = total_asset_value
                .checked_add(invest_tracker_data.asset_value)
                .ok_or(OrcaStrategyErrorCode::MathError)?;

            invest_tracker_data_vec.push(invest_tracker_data);
        }

        Ok((invest_tracker_data_vec, total_asset_value))
    }

    fn update_invest_tracker_after_swap(
        &mut self,
        invest_tracker_account: &AccountInfo,
        underlying_balance_before: u64,
        underlying_balance_after: u64,
        asset_balance_before: u64,
        asset_balance_after: u64,
        is_buying: bool,  // true when deploying funds or buying during rebalance
    ) -> Result<()> {
        let mut data = invest_tracker_account.try_borrow_mut_data()?;
        let mut invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;
    
        if is_buying {
            // When buying assets:
            // - asset_amount increases by what we received
            // - amount_invested increases by what we spent
            let new_asset_amount = asset_balance_after
                .checked_sub(asset_balance_before)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
            invest_tracker_data.asset_amount = invest_tracker_data.asset_amount
                .checked_add(new_asset_amount)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
    
            let underlying_spent = underlying_balance_before
                .checked_sub(underlying_balance_after)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
            invest_tracker_data.amount_invested = invest_tracker_data.amount_invested
                .checked_add(underlying_spent)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
    
            self.total_invested = self.total_invested
                .checked_add(underlying_spent)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
        } else {
            // When selling assets:
            // - asset_amount decreases by what we sold
            // - amount_withdrawn increases by what we received
            let asset_amount_sold = asset_balance_before
                .checked_sub(asset_balance_after)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
            invest_tracker_data.asset_amount = invest_tracker_data.asset_amount
                .checked_sub(asset_amount_sold)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
    
            let underlying_received = underlying_balance_after
                .checked_sub(underlying_balance_before)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
            invest_tracker_data.amount_withdrawn = invest_tracker_data.amount_withdrawn
                .checked_add(underlying_received)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
    
            // Decrease total_invested by the amount of underlying tokens received
            self.total_invested = self.total_invested
                .checked_sub(underlying_received)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
        }
    
        // Serialize and save the updated data
        let serialized = invest_tracker_data.try_to_vec()?;
        data[8..].copy_from_slice(&serialized);
    
        // Emit event with the latest state
        emit!(InvestTrackerSwapEvent {
            asset_mint: invest_tracker_data.asset_mint,
            invested_underlying_amount: invest_tracker_data.amount_invested
                .checked_sub(invest_tracker_data.amount_withdrawn)
                .ok_or(OrcaStrategyErrorCode::MathError)?,
            asset_amount: invest_tracker_data.asset_amount,
            asset_price: invest_tracker_data.sqrt_price,
            timestamp: Clock::get()?.unix_timestamp,
        });
    
        Ok(())
    }
}