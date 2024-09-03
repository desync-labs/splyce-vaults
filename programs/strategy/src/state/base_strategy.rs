use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use anchor_spl::token_interface::Mint;

use crate::state::*;
use crate::constants::*;

pub trait StrategyDataAccount {
    fn save_changes(&self, writer: &mut dyn std::io::Write) -> Result<()>;
    fn seeds(&self) -> [&[u8]; 3];
    fn key(&self) -> Pubkey {
        let seeds = self.seeds();
        Pubkey::create_program_address(&seeds, &crate::id()).unwrap()
    }
}

pub trait StrategyInit {
    fn init(
        &mut self, 
        bump: u8,
        vault: Pubkey, 
        underlying_mint: &InterfaceAccount<Mint>, 
        underlying_token_acc: Pubkey, 
        config_bytes: Vec<u8>
    ) -> Result<()>;
}

pub trait Strategy: StrategyDataAccount + StrategyInit {   
    // setters 
    fn deposit(&mut self, amount: u64) -> Result<()>;
    fn withdraw(&mut self, amount: u64) -> Result<()>;
    fn report<'info>(&mut self, accounts: &[AccountInfo<'info>]) -> Result<()>;
    fn deploy_funds<'info>(&mut self, accounts: &[AccountInfo<'info>], amount: u64) -> Result<()>;
    fn free_funds<'info>(&mut self, accounts: &[AccountInfo<'info>], amount: u64) -> Result<()>;

    // getters
    /// Returns the total funds in the strategy, this value is affected by gains and losses
    fn total_assets(&self) -> u64;
    fn available_deposit(&self) -> u64;
    fn available_withdraw(&self) -> u64;

    fn strategy_type(&self) -> StrategyType;
    fn token_account(&self) -> Pubkey;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum StrategyType {
    Simple,
    TradeFintech,
    RWA,
    Lending,
    Liquidation,
    Investor,
}

impl StrategyType {
    pub fn to_seed(&self) -> Vec<u8> {
        match self {
            StrategyType::Simple => SIMPLE_STRATEGY_SEED.as_bytes().to_vec(),
            StrategyType::TradeFintech => TRADE_FINTECH_STRATEGY_SEED.as_bytes().to_vec(),
            StrategyType::RWA => b"rwa".to_vec(),
            StrategyType::Lending => b"lending".to_vec(),
            StrategyType::Liquidation => b"liquidation".to_vec(),
            StrategyType::Investor => b"investor".to_vec(),
        }
    }

    // TODO: Implement for other strategies
    pub fn from_discriminator(discriminator: &[u8]) -> Option<Self> {
        if discriminator == SimpleStrategy::discriminator() {
            Some(StrategyType::Simple)
        } else if discriminator == TradeFintechStrategy::discriminator() {
            Some(StrategyType::TradeFintech)
        } else {
            None
        }
    } 

    pub fn space(&self) -> usize {
        match self {
            StrategyType::Simple => SimpleStrategy::LEN,
            StrategyType::TradeFintech => TradeFintechStrategy::LEN,
            StrategyType::RWA => 0,
            StrategyType::Lending => 0,
            StrategyType::Liquidation => 0,
            StrategyType::Investor => 0,
        }
    }
}