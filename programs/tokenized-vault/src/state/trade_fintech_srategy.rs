use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use std::convert::TryFrom;
use borsh::BorshDeserialize;
use std::result::Result as StdResult;

use crate::constants::STRATEGY_SEED;
use crate::strategy::*;

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

impl TryFrom<AccountInfo<'_>> for TradeFintechStrategy {
    type Error = ProgramError;

    fn try_from(account_info: AccountInfo<'_>) -> StdResult<Self, ProgramError> {
        // Ensure the account data has the correct length
        if account_info.data_len() < 8 {
            return Err(ProgramError::InvalidAccountData);
        }

        // Deserialize the account data into your struct
        let data = &account_info.data.borrow();
        msg!("data: {:?}", data);
        let strategy = TradeFintechStrategy::try_from_slice(data)
            .map_err(|_| ProgramError::InvalidAccountData)?;

        // Additional checks can be performed here (e.g., checking the discriminator)

        Ok(strategy)
    }
}

impl Strategy for TradeFintechStrategy {
    // fn seeds(&self) -> [&[u8], 3] {
    //     [
    //         &STRATEGY_SEED.as_bytes(),
    //         self.vault.as_ref(),
    //         self.bump.as_ref(),
    //     ]
    // }

    fn key(&self) -> Pubkey {
        let seeds = [
                &STRATEGY_SEED.as_bytes(),
                self.vault.as_ref(),
                self.bump.as_ref(),
            ];
        Pubkey::create_program_address(&seeds, &crate::id()).unwrap()
    }

    fn owner(&self) -> Pubkey {
        self.vault
    }

    fn available_deposit(&self) -> Result<u64> {
        // if deposit_period_ends is in the past, return 0
        if Clock::get()?.unix_timestamp > self.deposit_period_ends.try_into().unwrap() {
            return Ok(0);
        }
        Ok(self.deposit_limit - self.total_funds)
    }

    fn available_withdraw(&self) -> Result<u64> {
        // if lock_period_ends is in the future, return 0
        if Clock::get()?.unix_timestamp < self.lock_period_ends.try_into().unwrap() {
            return Ok(0);
        }
        Ok(self.total_idle)
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

    // fn get_strategy_type(&self) -> StrategyType {
    //     StrategyType::TradeFintech
    // }
}

impl TradeFintechStrategy {
    pub fn init(
        &mut self,
        bump: u8,
        vault: Pubkey, 
        underlying_mint: &InterfaceAccount<Mint>, 
        underlying_token_acc: Pubkey, 
        config: TradeFintechConfig
    ) -> Result<()> {
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

    fn deploy_funds(&mut self, amount: u64) -> Result<()> {
        self.total_idle -= amount;
        Ok(())
    }
}
