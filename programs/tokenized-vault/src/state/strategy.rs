use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::constants::STRATEGY_SEED;

#[account(zero_copy(unsafe))]
#[repr(packed)]
#[derive(Default, Debug)]
pub struct Strategy {
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

    pub pedosit_period_ends: i64,
    pub lock_period_ends: i64,
}

impl Strategy {
    pub fn seeds(&self) -> [&[u8]; 3] {
        [
            &STRATEGY_SEED.as_bytes(),
            self.vault.as_ref(),
            self.bump.as_ref(),
        ]
    }

    pub fn key(&self) -> Pubkey {
        Pubkey::create_program_address(&self.seeds(), &crate::id()).unwrap()
    }

    pub fn init(
        &mut self,
        bump: u8,
        vault: Pubkey, 
        underlying_mint: &InterfaceAccount<Mint>, 
        underlying_token_acc: Pubkey, 
        deposit_limit: u64, 
        pedosit_period_ends: i64, 
        lock_period_ends: i64) -> Result<()> {
            self.bump = [bump];
            self.vault = vault;
            self.underlying_mint = underlying_mint.key();
            self.undelying_decimals = underlying_mint.decimals;
            self.underlying_token_acc = underlying_token_acc;
            self.deposit_limit = deposit_limit;
            self.pedosit_period_ends = pedosit_period_ends;
            self.lock_period_ends = lock_period_ends;
            self.total_funds = 0;
            self.total_idle = 0;

            Ok(())
        }

    pub fn available_deposit(&self) -> Result<u64> {
        /// if deposit_period_ends is in the past, return 0
        if Clock::get()?.unix_timestamp > self.pedosit_period_ends  {
            return Ok(0);
        }
        Ok(self.deposit_limit - self.total_funds)
    }

    pub fn available_withdraw(&self) -> Result<u64> {
        /// if lock_period_ends is in the future, return 0
        if Clock::get()?.unix_timestamp < self.lock_period_ends {
            return Ok(0);
        }
        Ok(self.total_idle)
    }

    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        self.total_funds += amount;
        Ok(())
    }

    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        self.total_funds -= amount;
        Ok(())
    }

    pub fn deploy_funds(&mut self, amount: u64) -> Result<()> {
        self.total_idle -= amount;
        Ok(())
    }

}