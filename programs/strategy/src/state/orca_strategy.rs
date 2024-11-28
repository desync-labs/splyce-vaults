use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use anchor_spl::token::TokenAccount;

use super::base_strategy::*;
use super::StrategyType;
use super::fee_data::*;
use crate::error::ErrorCode;
use crate::events::{StrategyDepositEvent, AMMStrategyInitEvent, StrategyWithdrawEvent};
use crate::utils::{orca_swap_handler};
use crate::instructions::{Report, ReportProfit, ReportLoss, DeployFunds, FreeFunds, OrcaPurchaseAssets};
use crate::constants::{AMOUNT_SPECIFIED_IS_INPUT, REMAINING_ACCOUNTS_MIN, MAX_SQRT_PRICE_X64, MIN_SQRT_PRICE_X64, INVEST_TRACKER_SEED, NO_EXPLICIT_SQRT_PRICE_LIMIT, MAX_ASSIGNED_WEIGHT};
use crate::state::invest_tracker::*;

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

    pub total_invested: u64, //
    pub total_assets: u64, //TODO This part can be removed because this strategy deals with multiple assets
    pub deposit_limit: u64, //TODO later use or delete

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

    //Reporting profit is not suitable for this strategy since ETF or IndexFund's return varies depending on how we set the start, length and the end of a window.
    #[allow(unused_variables)]
    fn report_profit<'info>(&mut self, accounts: &ReportProfit<'info>, remaining: &[AccountInfo<'info>], profit: u64) -> Result<()> {
        Ok(())
    }

    //Reporting loss is not suitable for this strategy since ETF or IndexFund's return varies depending on how we set the start, length and the end of a window.
    #[allow(unused_variables)]
    fn report_loss<'info>(&mut self, accounts: &ReportLoss<'info>, remaining: &[AccountInfo<'info>],  loss: u64) -> Result<()> {
        Ok(())
    }

    #[allow(unused_variables)]
    fn harvest_and_report<'info>(&mut self, accounts: &Report<'info>, _remaining: &[AccountInfo<'info>]) -> Result<u64> {
        if accounts.underlying_token_account.key() != self.underlying_token_acc {
            return Err(ErrorCode::InvalidAccount.into());
        }
        let new_total_assets = accounts.underlying_token_account.amount;
        Ok(new_total_assets)
    }

    //Free fund swaps asset to underlying token
    fn free_funds<'info>(&mut self, accounts: &FreeFunds<'info>, remaining: &[AccountInfo<'info>], amount: u64) -> Result<()> {
        // Calculate number of swaps based on remaining accounts length
        let num_swaps = remaining.len() / 12;
        if remaining.len() != num_swaps * 12 {
            return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        }

        // First pass: Calculate total invested amount across all invest trackers
        let mut total_invested = 0u64;
        let mut invested_amounts = Vec::with_capacity(num_swaps);

        for i in 0..num_swaps {
            let invest_tracker_account = &remaining[i * 12 + 10];
            let data = invest_tracker_account.try_borrow_data()?;
            let invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;
            
            invested_amounts.push(invest_tracker_data.amount_invested);
            total_invested = total_invested
                .checked_add(invest_tracker_data.amount_invested)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
        }

        // Iterate through each swap operation
        for i in 0..num_swaps {
            let start = i * 12;

            // Calculate proportional amount for this swap
            let amount_per_swap = if total_invested > 0 {
                (amount as u128)
                    .checked_mul(invested_amounts[i] as u128)
                    .ok_or(OrcaStrategyErrorCode::MathError)?
                    .checked_div(total_invested as u128)
                    .ok_or(OrcaStrategyErrorCode::MathError)? as u64
            } else {
                amount.checked_div(num_swaps as u64)
                    .ok_or(OrcaStrategyErrorCode::MathError)?
            };

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
            let invest_tracker_account = &remaining[start + 10];
            // The 12th account (start + 10) is intentionally skipped because it's the strategy account itself

            // Get the invest tracker data to determine swap direction
            let mut data = invest_tracker_account.try_borrow_mut_data()?;
            let invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;
            let is_a_to_b = invest_tracker_data.a_to_b_for_purchase;

            // Validate underlying token account based on swap direction
            if is_a_to_b {
                // When a_to_b is true, token_owner_account_a should be the underlying token
                if token_owner_account_a.key() != self.underlying_token_acc {
                    return Err(OrcaStrategyErrorCode::InvalidUnderlyingToken.into());
                }
            } else {
                // When a_to_b is false, token_owner_account_b should be the underlying token
                if token_owner_account_b.key() != self.underlying_token_acc {
                    return Err(OrcaStrategyErrorCode::InvalidUnderlyingToken.into());
                }
            }

            // Get balances before swap
            let underlying_account_before_swap = if is_a_to_b {
                let data_before = token_owner_account_a.data.borrow();
                TokenAccount::try_deserialize(&mut &data_before[..])?
            } else {
                let data_before = token_owner_account_b.data.borrow();
                TokenAccount::try_deserialize(&mut &data_before[..])?
            };
            let underlying_balance_before_swap = underlying_account_before_swap.amount;
            msg!("underlying_balance_before_swap: {}", underlying_balance_before_swap);

            let asset_account_before_swap = if is_a_to_b {
                let data_before = token_owner_account_b.data.borrow();
                TokenAccount::try_deserialize(&mut &data_before[..])?
            } else {
                let data_before = token_owner_account_a.data.borrow();
                TokenAccount::try_deserialize(&mut &data_before[..])?
            };
            let asset_balance_before_swap = asset_account_before_swap.amount;
            msg!("asset_balance_before_swap: {}", asset_balance_before_swap);

            msg!("amount_per_swap: {}", amount_per_swap);

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
                amount_per_swap, // amount to swap
                u64::MAX, // other_amount_threshold
                if !is_a_to_b { MIN_SQRT_PRICE_X64 } else { MAX_SQRT_PRICE_X64 }, // sqrt_price_limit
                !AMOUNT_SPECIFIED_IS_INPUT, // amount_specified_is_input
                !is_a_to_b, // a_to_b
            )?;

            // Get balances after swap
            let underlying_account_after_swap = if is_a_to_b {
                let data_after = token_owner_account_a.data.borrow();
                TokenAccount::try_deserialize(&mut &data_after[..])?
            } else {
                let data_after = token_owner_account_b.data.borrow();
                TokenAccount::try_deserialize(&mut &data_after[..])?
            };
            let underlying_balance_after_swap = underlying_account_after_swap.amount;
            msg!("underlying_balance_after_swap: {}", underlying_balance_after_swap);

            let asset_account_after_swap = if is_a_to_b {
                let data_after = token_owner_account_b.data.borrow();
                TokenAccount::try_deserialize(&mut &data_after[..])?
            } else {
                let data_after = token_owner_account_a.data.borrow();
                TokenAccount::try_deserialize(&mut &data_after[..])?
            };
            let asset_balance_after_swap = asset_account_after_swap.amount;
            msg!("asset_balance_after_swap: {}", asset_balance_after_swap);

            // Update invest tracker data
            let mut updated_data = invest_tracker_data;
            let asset_amount_change = asset_balance_before_swap.checked_sub(asset_balance_after_swap).unwrap_or(0);
            updated_data.asset_amount = updated_data.asset_amount.checked_sub(asset_amount_change).unwrap_or(0);
            
            let amount_withdrawn_change = underlying_balance_after_swap.checked_sub(underlying_balance_before_swap).unwrap_or(0);
            updated_data.amount_withdrawn = updated_data.amount_withdrawn
                .checked_add(amount_withdrawn_change)
                .ok_or(OrcaStrategyErrorCode::MathError)?;
            
            let serialized_data = updated_data.try_to_vec()?;
            data[8..].copy_from_slice(&serialized_data);
        }

        Ok(())
    }

    //Deploy funds swaps underlying token to asset
    fn deploy_funds<'info>(&mut self, accounts: &DeployFunds<'info>, remaining: &[AccountInfo<'info>], amount: u64) -> Result<()> {
        // Verify we have enough remaining accounts
        // if remaining.len() < 9 {
        //     return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        // }

        // // Extract accounts from remaining array
        // let whirlpool_program = &remaining[0];
        // let whirlpool = &remaining[1];
        // let token_owner_account_a = &remaining[2];
        // let token_vault_a = &remaining[3];
        // let token_owner_account_b = &remaining[4];
        // let token_vault_b = &remaining[5];
        // let tick_array_0 = &remaining[6];
        // let tick_array_1 = &remaining[7];
        // let tick_array_2 = &remaining[8];
        // let oracle = &remaining[9];

        // orca_swap_handler(
        //     whirlpool_program,
        //     &accounts.token_program,
        //     &accounts.strategy,  // strategy account is the authority
        //     whirlpool,
        //     token_owner_account_a,
        //     token_vault_a,
        //     token_owner_account_b,
        //     token_vault_b,
        //     tick_array_0,
        //     tick_array_1,
        //     tick_array_2,
        //     oracle,
        //     &[&self.seeds()],  // PDA seeds for signing
        //     amount,            // Amount to swap
        //     0,                // other_amount_threshold (minimum amount to receive)
        //     0,                // sqrt_price_limit (0 = no limit)
        //     AMOUNT_SPECIFIED_IS_INPUT,             // amount_specified_is_input, here it should be true
        //     self.deploy_funds_direction,            // a_to_b (false for devUSDC -> WSOL, which is b_to_a)
        // )?;

        Ok(())
    }

    fn set_total_assets(&mut self, total_assets: u64) {
        self.total_assets = total_assets;
    }

    fn orca_purchase_assets<'info>(
        &mut self,
        accounts: &OrcaPurchaseAssets<'info>,
        remaining: &[AccountInfo<'info>],
        amount: u64,
    ) -> Result<()> {
        // Calculate number of swaps based on remaining accounts length
        let num_swaps = remaining.len() / 12;
        if remaining.len() != num_swaps * 12 {
            return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        }

        // First pass: Calculate total weight and validate it equals MAX_ASSIGNED_WEIGHT
        let mut total_weight = 0u64;
        let mut weights = Vec::with_capacity(num_swaps);

        for i in 0..num_swaps {
            let invest_tracker_account = &remaining[i * 12 + 10];
            let data = invest_tracker_account.try_borrow_data()?;
            let invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;
            
            weights.push(invest_tracker_data.assigned_weight);
            total_weight = total_weight
                .checked_add(invest_tracker_data.assigned_weight.into())
                .ok_or(OrcaStrategyErrorCode::MathError)?;
        }

        // Verify total weight equals MAX_ASSIGNED_WEIGHT
        if total_weight != MAX_ASSIGNED_WEIGHT as u64 {
            return Err(OrcaStrategyErrorCode::InvalidTotalWeight.into());
        }

        // Iterate through each swap operation
        for i in 0..num_swaps {
            let start = i * 12;

            // Calculate amount for this swap based on weight
            let amount_per_swap = (amount as u128)
                .checked_mul(weights[i] as u128)
                .ok_or(OrcaStrategyErrorCode::MathError)?
                .checked_div(MAX_ASSIGNED_WEIGHT as u128)
                .ok_or(OrcaStrategyErrorCode::MathError)? as u64;

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
            let invest_tracker_account = &remaining[start + 10];

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
            let (expected_invest_tracker, _) = Pubkey::find_program_address(
                &[
                    INVEST_TRACKER_SEED.as_bytes(),
                    &asset_mint.to_bytes(),
                    accounts.strategy.key().as_ref()
                ],
                &crate::ID
            );
            require!(expected_invest_tracker == invest_tracker_account.key(), ErrorCode::InvalidAccount);

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

            msg!("underlying_balance_before_swap: {}", underlying_balance_before_swap);
            msg!("asset_balance_before_swap: {}", asset_balance_before_swap);

            // Perform the swap
            orca_swap_handler(
                whirlpool_program,
                &accounts.token_program,
                &accounts.strategy,  // strategy account is the authority
                whirlpool,
                token_owner_account_a,
                token_vault_a,
                token_owner_account_b,
                token_vault_b,
                tick_array_0,
                tick_array_1,
                tick_array_2,
                oracle,
                &[&self.seeds()],  // PDA seeds for signing
                amount_per_swap,    // Amount to swap
                0,                  // other_amount_threshold (minimum amount to receive)
                NO_EXPLICIT_SQRT_PRICE_LIMIT, // sqrt_price_limit
                AMOUNT_SPECIFIED_IS_INPUT,    // amount_specified_is_input
                is_a_to_b,         // a_to_b
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

            msg!("underlying_balance_after_swap: {}", underlying_balance_after_swap);
            msg!("asset_balance_after_swap: {}", asset_balance_after_swap);

            // Update invest tracker data in its own scope
            {
                let mut data = invest_tracker_account.try_borrow_mut_data()?;
                let mut invest_tracker_data = InvestTracker::try_from_slice(&data[8..])?;

                let new_asset_amount = asset_balance_after_swap
                    .checked_sub(asset_balance_before_swap)
                    .ok_or(OrcaStrategyErrorCode::MathError)?;
                invest_tracker_data.asset_amount = invest_tracker_data.asset_amount
                    .checked_add(new_asset_amount)
                    .ok_or(OrcaStrategyErrorCode::MathError)?;

                let new_invested_amount = underlying_balance_before_swap
                    .checked_sub(underlying_balance_after_swap)
                    .ok_or(OrcaStrategyErrorCode::MathError)?;
                invest_tracker_data.amount_invested = invest_tracker_data.amount_invested
                    .checked_add(new_invested_amount)
                    .ok_or(OrcaStrategyErrorCode::MathError)?;

                self.total_invested = self.total_invested
                    .checked_add(new_invested_amount)
                    .ok_or(OrcaStrategyErrorCode::MathError)?;

                let serialized_data = invest_tracker_data.try_to_vec()?;
                data[8..].copy_from_slice(&serialized_data);
            }
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