use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::constants::*;
use crate::base_strategy::*;
use crate::error::ErrorCode;
use crate::utils::token;

#[account()]
#[derive(Default, Debug)]
pub struct SimpleStrategy {
    /// Bump to identify PDA
    pub bump: [u8; 1],

    /// vault
    pub vault: Pubkey,
    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    pub manager: Pubkey,
    // this value mast be u64 because of the borsh serialization
    pub undelying_decimals: u8,
    pub total_assets: u64,
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

    fn vault(&self) -> Pubkey {
        self.vault
    }

    fn manager(&self) -> Pubkey {
        self.manager
    }

    fn deposit(&mut self, amount: u64) -> Result<()> {
        self.total_assets += amount;
        Ok(())
    }

    fn withdraw(&mut self, amount: u64) -> Result<()> {
        self.total_assets -= amount;
        Ok(())
    }

    fn set_manager(&mut self, manager: Pubkey) -> Result<()> {
        self.manager = manager;
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

    fn token_account(&self) -> Pubkey {
        self.underlying_token_acc
    }

    fn deploy_funds<'info>(&mut self, _accounts: &[AccountInfo<'info>], _amount: u64) -> Result<()> {
        Ok(())
    }

    fn free_funds<'info>(&mut self, _accounts: &[AccountInfo<'info>], _amount: u64) -> Result<()> {
        Ok(())
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
}


impl SimpleStrategy {
    pub const LEN: usize = 8 + 1 + 32 + 32 + 32 + 32 + 1 + 8 + 8;
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
