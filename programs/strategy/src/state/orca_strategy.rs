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
use crate::constants::{AMOUNT_SPECIFIED_IS_INPUT, REMAINING_ACCOUNTS_MIN, MAX_SQRT_PRICE_X64, MIN_SQRT_PRICE_X64};

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
    pub deploy_funds_direction: bool, // if true, deploy funds swap with b_to_a, otherwise a_to_b and free funds swap in opposite direction
}   

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct OrcaStrategyConfig {
    pub deposit_limit: u64,
    pub deposit_period_ends: i64,
    pub lock_period_ends: i64,
    pub performance_fee: u64,
    pub fee_manager: Pubkey,
    pub deploy_funds_direction: bool,
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

    //Reporting profit is not suitable for this strategy since ETF or IndexFund’s return varies depending on how we set the start, length and the end of a window.
    #[allow(unused_variables)]
    fn report_profit<'info>(&mut self, accounts: &ReportProfit<'info>, remaining: &[AccountInfo<'info>], profit: u64) -> Result<()> {
        Ok(())
    }

    //Reporting loss is not suitable for this strategy since ETF or IndexFund’s return varies depending on how we set the start, length and the end of a window.
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
        // Verify we have enough remaining accounts
        if remaining.len() < REMAINING_ACCOUNTS_MIN {
            return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        }

        // Extract accounts from remaining array
        let whirlpool_program = &remaining[0];
        let whirlpool = &remaining[1];
        let token_owner_account_a = &remaining[2];
        let token_vault_a = &remaining[3];
        let token_owner_account_b = &remaining[4];
        let token_vault_b = &remaining[5];
        let tick_array_0 = &remaining[6];
        let tick_array_1 = &remaining[7];
        let tick_array_2 = &remaining[8];
        let oracle = &remaining[9];

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
            amount,            // Amount to swap
            u64::MAX,         // other_amount_threshold (maximum amount to receive)
            if !self.deploy_funds_direction { MAX_SQRT_PRICE_X64 } else { MIN_SQRT_PRICE_X64 },  // sqrt_price_limit for A->B (true) = MIN, B->A (false) = MAX
            !AMOUNT_SPECIFIED_IS_INPUT,             // !amount_specified_is_input, here it should be false
            !self.deploy_funds_direction,            // a_to_b (true for WSOL -> devUSDC, which is a_to_b)
        )?;

        Ok(())
    }

    //Deploy funds swaps underlying token to asset
    fn deploy_funds<'info>(&mut self, accounts: &DeployFunds<'info>, remaining: &[AccountInfo<'info>], amount: u64) -> Result<()> {
        // Verify we have enough remaining accounts
        if remaining.len() < 9 {
            return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        }

        // Extract accounts from remaining array
        let whirlpool_program = &remaining[0];
        let whirlpool = &remaining[1];
        let token_owner_account_a = &remaining[2];
        let token_vault_a = &remaining[3];
        let token_owner_account_b = &remaining[4];
        let token_vault_b = &remaining[5];
        let tick_array_0 = &remaining[6];
        let tick_array_1 = &remaining[7];
        let tick_array_2 = &remaining[8];
        let oracle = &remaining[9];

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
            amount,            // Amount to swap
            0,                // other_amount_threshold (minimum amount to receive)
            0,                // sqrt_price_limit (0 = no limit)
            AMOUNT_SPECIFIED_IS_INPUT,             // amount_specified_is_input, here it should be true
            self.deploy_funds_direction,            // a_to_b (false for devUSDC -> WSOL, which is b_to_a)
        )?;

        Ok(())
    }

    fn set_total_assets(&mut self, total_assets: u64) {
        self.total_assets = total_assets;
    }

    fn orca_purchase_assets<'info>(
        &mut self,
        accounts: &OrcaPurchaseAssets<'info>,
        remaining: &[AccountInfo<'info>],
        amount: Vec<u64>,
        a_to_b: Vec<bool>,
    ) -> Result<()> {
        // Verify we have enough remaining accounts: length of a_to_b * 11
        if remaining.len() < a_to_b.len() * 11 {
            return Err(OrcaStrategyErrorCode::NotEnoughAccounts.into());
        }

        // Iterate through each swap operation
        for (index, is_a_to_b) in a_to_b.iter().enumerate() {
            let start = index * 11;

            // Access the appropriate set of remaining accounts, skipping the 11th account
            let whirlpool_program = &remaining[start + 0];
            let whirlpool = &remaining[start + 1];
            let token_owner_account_a = &remaining[start + 2];
            let token_vault_a = &remaining[start + 3];
            let token_owner_account_b = &remaining[start + 4];
            let token_vault_b = &remaining[start + 5];
            let tick_array_0 = &remaining[start + 6];
            let tick_array_1 = &remaining[start + 7];
            let tick_array_2 = &remaining[start + 8];
            let oracle = &remaining[start + 9];
            // The 11th account (start + 10) is intentionally skipped because it's the strategy account itself

            // Validate underlying token account based on swap direction
            if *is_a_to_b {
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

            // Deserialize the TokenAccount before the swap
            let token_account_before_swap = if *is_a_to_b {
                let data_before = token_owner_account_a.data.borrow();
                TokenAccount::try_deserialize(&mut &data_before[..])?
            } else {
                let data_before = token_owner_account_b.data.borrow();
                TokenAccount::try_deserialize(&mut &data_before[..])?
            };
            let token_balance_before_swap = token_account_before_swap.amount;
            msg!("token_balance_before_swap: {}", token_balance_before_swap);

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
                amount[index],      // Amount to swap
                0,                  // other_amount_threshold (minimum amount to receive)
                0,                  // sqrt_price_limit (0 = no limit)
                AMOUNT_SPECIFIED_IS_INPUT,  // amount_specified_is_input
                *is_a_to_b,         // a_to_b
            )?;

            // Deserialize the TokenAccount after the swap
            let token_account_after_swap = if *is_a_to_b {
                let data_after = token_owner_account_a.data.borrow();
                TokenAccount::try_deserialize(&mut &data_after[..])?
            } else {
                let data_after = token_owner_account_b.data.borrow();
                TokenAccount::try_deserialize(&mut &data_after[..])?
            };
            let token_balance_after_swap = token_account_after_swap.amount;
            msg!("token_balance_after_swap: {}", token_balance_after_swap);

            //save the difference between the before and after swap balances to the total invested
            self.total_invested += token_balance_after_swap - token_balance_before_swap;
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
        self.deploy_funds_direction = config.deploy_funds_direction;

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
                deploy_funds_direction: self.deploy_funds_direction,
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