use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::base_strategy::*;
use crate::error::ErrorCode;
use crate::constants::TRADE_FINTECH_STRATEGY_SEED;
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

    pub total_idle: u64,
    pub total_funds: u64,
    pub deposit_limit: u64,

    pub deposit_period_ends: u64,
    pub lock_period_ends: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TradeFintechConfig {
    pub deposit_limit: u64,
    pub deposit_period_ends: u64,
    pub lock_period_ends: u64,
}

impl Strategy for TradeFintechStrategy {
    fn strategy_type(&self) -> StrategyType {
        StrategyType::TradeFintech
    }

    fn deposit(&mut self, amount: u64) -> Result<()> {
        self.total_funds += amount;
        Ok(())
    }

    fn withdraw(&mut self, amount: u64) -> Result<()> {
        self.total_funds -= amount;
        Ok(())
    }

    fn harvest(&mut self) -> Result<()> {
        // todo: implement harvest
        Ok(())
    }

    fn free_funds(&mut self, amount: u64) -> Result<()> {
        Ok(())
    }

    fn token_account(&self) -> Pubkey {
        self.underlying_token_acc
    }

    fn total_assets(&self) -> u64 {
        self.total_funds + self.total_idle
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
        self.deposit_limit - self.total_funds
    }

    fn available_withdraw(&self) -> u64 {
        // if lock_period_ends is in the future, return 0
        match Clock::get() {
            Ok(clock) => {
                if clock.unix_timestamp < self.lock_period_ends.try_into().unwrap_or(0) {
                    return 0;
                }
            }
            Err(_) => return 0,
        }
        self.total_idle
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
        let config = TradeFintechConfig::try_from_slice(&config_bytes)
        .map_err(|_| ErrorCode::InvalidStrategyConfig)?;

        self.bump = [bump];
        self.vault = vault;
        self.underlying_mint = underlying_mint.key();
        self.undelying_decimals = underlying_mint.decimals;
        self.underlying_token_acc = underlying_token_acc;
        self.deposit_limit = config.deposit_limit;
        self.deposit_period_ends = config.deposit_period_ends;
        self.lock_period_ends = config.lock_period_ends;
        self.total_funds = 0;
        self.total_idle = 0;

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
