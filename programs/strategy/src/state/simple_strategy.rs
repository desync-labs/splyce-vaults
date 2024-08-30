use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::constants::*;
use crate::strategy::*;
use crate::error::ErrorCode;

#[account()]
#[derive(Default, Debug)]
pub struct SimpleStrategy {
    /// Bump to identify PDA
    pub bump: [u8; 1],

    /// vault
    pub vault: Pubkey,
    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    // this value mast be u64 because of the borsh serialization
    pub undelying_decimals: u8,
    pub total_funds: u64,
    pub deposit_limit: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Clone, Debug)]
pub struct SimpleStrategyConfig {
    pub deposit_limit: u64,
}

impl Strategy for SimpleStrategy {
    fn strategy_type(&self) -> StrategyType {
        StrategyType::Simple
    }

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
        self.total_funds = 0;

        Ok(())
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

    fn seeds(&self) -> [&[u8]; 3] {
        [
            &SIMPLE_STRATEGY_SEED.as_bytes(),
            self.vault.as_ref(),
            self.bump.as_ref(),
        ]
    }

    fn token_account(&self) -> Pubkey {
        self.underlying_token_acc
    }

    fn free_funds(&mut self, amount: u64) -> Result<()> {
        Ok(())
    }

    fn total_assets(&self) -> u64 {
        self.total_funds
    }

    fn available_deposit(&self) -> u64 {
        self.deposit_limit - self.total_funds
    }

    fn available_withdraw(&self) -> u64 {
        self.deposit_limit
    }

}


impl SimpleStrategy {
    pub const LEN: usize = 8 + 1 + 32 + 32 + 32 + 1 + 8 + 8;

    fn owner(&self) -> Pubkey {
        // self.vault
        Pubkey::default()
    }
}
