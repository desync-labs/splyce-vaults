use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use anchor_spl::token_interface::Mint;

use crate::state::*;
use crate::constants::{SIMPLE_STRATEGY_SEED, TRADE_FINTECH_STRATEGY_SEED, DISCRIMINATOR_LEN};

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
        index: u8,
        vault: Pubkey, 
        underlying_mint: &InterfaceAccount<Mint>, 
        underlying_token_acc: Pubkey, 
        config_bytes: Vec<u8>
    ) -> Result<()>;
}

pub trait StrategyManagement {
    fn manager(&self) -> Pubkey;
    fn set_manager(&mut self, manager: Pubkey) -> Result<()>;
}

pub trait Strategy: StrategyDataAccount + StrategyInit + StrategyManagement {   
    // setters 
    fn deposit(&mut self, amount: u64) -> Result<()>;
    fn withdraw(&mut self, amount: u64) -> Result<()>;
    fn harvest_and_report<'info>(&mut self, accounts: &[AccountInfo<'info>]) -> Result<u64>;
    fn deploy_funds<'info>(&mut self, accounts: &[AccountInfo<'info>], amount: u64) -> Result<()>;
    fn free_funds<'info>(&mut self, accounts: &[AccountInfo<'info>], amount: u64) -> Result<()>;
    fn set_total_assets(&mut self, total_assets: u64);

    // getters
    fn strategy_type(&self) -> StrategyType;
    fn vault(&self) -> Pubkey;
    /// Returns the total funds in the strategy, this value is affected by gains and losses
    fn total_assets(&self) -> u64;
    fn available_deposit(&self) -> u64;
    fn available_withdraw(&self) -> u64;
    fn token_account(&self) -> Pubkey;

    fn fee_data(&mut self) -> &mut FeeData;
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
            StrategyType::Simple => DISCRIMINATOR_LEN + SimpleStrategy::INIT_SPACE,
            StrategyType::TradeFintech => DISCRIMINATOR_LEN + TradeFintechStrategy::INIT_SPACE,
            StrategyType::RWA => 0,
            StrategyType::Lending => 0,
            StrategyType::Liquidation => 0,
            StrategyType::Investor => 0,
        }
    }
}