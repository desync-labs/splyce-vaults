use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::base_strategy::*;
use crate::error::ErrorCode;
use crate::constants::TRADE_FINTECH_STRATEGY_SEED;
use crate::utils::token;

#[account]
// #[repr(packed)]
#[derive(Default, Debug)]
pub struct TradeFintechStrategy {
    /// Bump to identify PDA
    pub bump: [u8; 1],

    /// vault
    pub vault: Pubkey,

    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    pub undelying_decimals: u8,

    pub total_invested: u64,
    pub total_assets: u64,
    pub deposit_limit: u64,

    pub deposit_period_ends: i64,
    pub lock_period_ends: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TradeFintechConfig {
    pub deposit_limit: u64,
    pub deposit_period_ends: i64,
    pub lock_period_ends: i64,
}

#[error_code]
pub enum TradeFintechErrorCode {
    #[msg("Deposit period has not ended")]
    DepositPeriodNotEnded,
    #[msg("Lock period has not ended")]
    LockPeriodNotEnded,
}

impl Strategy for TradeFintechStrategy {
    fn strategy_type(&self) -> StrategyType {
        StrategyType::TradeFintech
    }

    fn deposit(&mut self, amount: u64) -> Result<()> {
        self.total_assets += amount;
        Ok(())
    }

    fn withdraw(&mut self, amount: u64) -> Result<()> {
        self.total_assets -= amount;
        Ok(())
    }

    /// accounts[0] - underlying token account
    fn report<'info>(&mut self, accounts: &[AccountInfo<'info>]) -> Result<()> {
        // check if the remaining_accounts[0] is the strategy token account
        if *accounts[0].key != self.underlying_token_acc {
            return Err(ErrorCode::InvalidAccount.into());
        }

        self.total_assets = token::get_balance(&accounts[0])?;
        Ok(())
    }

    /// accounts should be the next:
    /// - manager token account
    /// - strategy token account
    /// - manager account 
    /// - token program
    fn free_funds<'info>(&mut self, accounts: &[AccountInfo<'info>], amount: u64) -> Result<()> {
        let timestamp = Clock::get()?.unix_timestamp;

        // if it's still in the deposit period we don't do anything, cause no funds were deployed
        if timestamp < self.deposit_period_ends {
            return Ok(())
        }

        // can't free funds during lock period
        if timestamp < self.lock_period_ends {
            return Err(TradeFintechErrorCode::LockPeriodNotEnded.into());
        }

        token::transfer_token_to(
            accounts[3].to_account_info(),
            accounts[0].to_account_info(),
            accounts[1].to_account_info(),
            accounts[2].to_account_info(),
            amount
        )?;

        self.total_invested = 0;

        // }
        Ok(())
    }

    /// accounts should be the next:
    /// - strategy token account
    /// - manager token account
    /// - strategy account
    /// - token program
    fn deploy_funds<'info>(&mut self, accounts: &[AccountInfo<'info>], amount: u64) -> Result<()> {
        let timestamp = Clock::get()?.unix_timestamp;
        if timestamp < self.deposit_period_ends {
            return Err(TradeFintechErrorCode::DepositPeriodNotEnded.into());
        }

        let seeds = self.seeds();
        token::transfer_token_from(
            accounts[3].to_account_info(),
            accounts[0].to_account_info(),
            accounts[1].to_account_info(),
            accounts[2].to_account_info(),
            amount,
            &seeds
        )?;

        self.total_invested += amount;
        Ok(())
    }

    fn token_account(&self) -> Pubkey {
        self.underlying_token_acc
    }

    fn total_assets(&self) -> u64 {
        self.total_assets
    }

    fn available_deposit(&self) -> u64 {
        // if deposit_period_ends is in the past, return 0
        match Clock::get() {
            Ok(clock) => {
                if clock.unix_timestamp > self.deposit_period_ends.try_into().unwrap_or(0) {
                    return 0;
                }
            }
            Err(_) => return 0,
        }
        self.deposit_limit - self.total_assets
    }

    fn available_withdraw(&self) -> u64 {
        // if lock_period_ends is in the future, return 0
        match Clock::get() {
            Ok(clock) => {
                if clock.unix_timestamp < self.deposit_period_ends || clock.unix_timestamp > self.lock_period_ends {
                    return self.total_assets;
                } else {
                    return 0;
                }
            }
            Err(_) => return 0,
        }
    }
}

impl TradeFintechStrategy {
    pub const LEN: usize = 8 + 1 + 32 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8;
}

impl StrategyInit for TradeFintechStrategy {
    fn init(
        &mut self,
        bump: u8,
        vault: Pubkey, 
        underlying_mint: &InterfaceAccount<Mint>, 
        underlying_token_acc: Pubkey, 
        config_bytes: Vec<u8>
    ) -> Result<()> {
        let config: TradeFintechConfig = TradeFintechConfig::try_from_slice(&config_bytes)
        .map_err(|_| ErrorCode::InvalidStrategyConfig)?;

        self.bump = [bump];
        self.vault = vault;
        self.underlying_mint = underlying_mint.key();
        self.undelying_decimals = underlying_mint.decimals;
        self.underlying_token_acc = underlying_token_acc;
        self.deposit_limit = config.deposit_limit;
        self.deposit_period_ends = config.deposit_period_ends;
        self.lock_period_ends = config.lock_period_ends;
        self.total_assets = 0;
        self.total_invested = 0;

        Ok(())
    }
}

impl StrategyDataAccount for TradeFintechStrategy {
    fn save_changes(&self, writer: &mut dyn std::io::Write) -> Result<()> {
        self.try_to_vec().map_err(|_| ErrorCode::SerializationError.into()).and_then(|vec| {
            writer.write_all(&vec).map_err(|_| ErrorCode::SerializationError.into())
        })
    }
    
    fn seeds(&self) -> [&[u8]; 3] {
        [
            TRADE_FINTECH_STRATEGY_SEED.as_bytes(),
            self.vault.as_ref(),
            self.bump.as_ref(),
        ]
    }
}
