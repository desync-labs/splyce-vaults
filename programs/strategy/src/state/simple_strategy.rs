use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::constants::*;
use crate::base_strategy::*;
use crate::fee_data::*;
use crate::error::ErrorCode;
use crate::events::StrategyDepositEvent;
use crate::events::StrategyInitEvent;
use crate::events::StrategyWithdrawEvent;
use crate::utils::token;

use super::fee_data;

#[account()]
#[derive(Default, Debug)]
pub struct SimpleStrategy {
    /// Bump to identify PDA
    pub bump: [u8; 1],

    /// vault
    pub vault: Pubkey,
    pub manager: Pubkey,
    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,

    // this value mast be u64 because of the borsh serialization
    pub undelying_decimals: u8,
    pub total_assets: u64,
    pub deposit_limit: u64,

    pub fee_data: FeeData,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Clone, Debug)]
pub struct SimpleStrategyConfig {
    pub deposit_limit: u64,
    pub performance_fee: u64,
    pub fee_manager: Pubkey,
}

impl SimpleStrategy {
    pub const LEN: usize = 8 + 1 + 32 + 32 + 32 + 32 + 32 + 1 + 8 + 8 + 8 + 8;
}

impl StrategyManagement for SimpleStrategy {
    fn manager(&self) -> Pubkey {
        self.manager
    }

    fn set_manager(&mut self, manager: Pubkey) -> Result<()> {
        self.manager = manager;
        Ok(())
    }
}

impl Strategy for SimpleStrategy {
    fn strategy_type(&self) -> StrategyType {
        StrategyType::Simple
    }

    fn vault(&self) -> Pubkey {
        self.vault
    }

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

    /// accounts[0] - underlying token account
    fn harvest_and_report<'info>(&mut self, accounts: &[AccountInfo<'info>]) -> Result<u64> {
        // check if the remaining_accounts[0] is the strategy token account
        if *accounts[0].key != self.underlying_token_acc {
            return Err(ErrorCode::InvalidAccount.into());
        }
        let new_total_assets = token::get_balance(&accounts[0])?;
        Ok(new_total_assets)
    }

    fn token_account(&self) -> Pubkey {
        self.underlying_token_acc
    }

    fn deploy_funds<'info>(&mut self, _accounts: &[AccountInfo<'info>], _amount: u64) -> Result<()> {
        Ok(())
    }

    fn free_funds<'info>(&mut self, _accounts: &[AccountInfo<'info>], _amount: u64) -> Result<()> {
        Ok(())
    }

    fn set_total_assets(&mut self, total_assets: u64) {
        self.total_assets = total_assets;
    }

    fn total_assets(&self) -> u64 {
        self.total_assets
    }

    fn available_deposit(&self) -> u64 {
        self.deposit_limit - self.total_assets
    }

    fn available_withdraw(&self) -> u64 {
        self.deposit_limit
    }

    fn fee_data(&mut self) -> &mut FeeData {
        &mut self.fee_data
    }
}

impl StrategyInit for SimpleStrategy {
    fn init(
        &mut self,
        bump: u8,
        vault: Pubkey, 
        underlying_mint: &InterfaceAccount<Mint>, 
        underlying_token_acc: Pubkey, 
        config_bytes: Vec<u8>
    ) -> Result<()> {
        let config = SimpleStrategyConfig::try_from_slice(&config_bytes)
        .map_err(|_| ErrorCode::InvalidStrategyConfig)?;

        self.bump = [bump]; 
        self.vault = vault;
        self.underlying_mint = underlying_mint.key();
        self.undelying_decimals = underlying_mint.decimals;
        self.underlying_token_acc = underlying_token_acc;
        self.deposit_limit = config.deposit_limit;
        self.total_assets = 0;

        self.fee_data = FeeData {
            fee_manager: config.fee_manager,
            performance_fee: config.performance_fee,
            fee_balance: 0,
        };

        emit!(
            StrategyInitEvent 
            {
                account_key: self.key(),
                strategy_type: String::from("simple"),
                vault: self.vault,
                underlying_mint: self.underlying_mint,
                underlying_token_acc: self.underlying_token_acc,
                undelying_decimals: self.undelying_decimals,
                deposit_limit: self.deposit_limit,
                deposit_period_ends: 0,
                lock_period_ends: 0,
            });
        Ok(())
    }
}

impl StrategyDataAccount for SimpleStrategy {
    fn save_changes(&self, writer: &mut dyn std::io::Write) -> Result<()> {
        self.try_to_vec().map_err(|_| ErrorCode::SerializationError.into()).and_then(|vec| {
            writer.write_all(&vec).map_err(|_| ErrorCode::SerializationError.into())
        })
    }
    fn seeds(&self) -> [&[u8]; 3] {
        [
            &SIMPLE_STRATEGY_SEED.as_bytes(),
            self.vault.as_ref(),
            self.bump.as_ref(),
        ]
    }
}
