use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use anchor_spl::token_interface::Mint;

use crate::state::*;
use crate::constants::*;

// #[derive(Clone, Debug)]
pub trait Strategy {
    fn init(
        &mut self, 
        bump: u8,
        vault: Pubkey, 
        underlying_mint: &InterfaceAccount<Mint>, 
        underlying_token_acc: Pubkey, 
        config_bytes: Vec<u8>
    ) -> Result<()>;
    fn deposit(&mut self, amount: u64) -> Result<()>;
    fn withdraw(&mut self, amount: u64) -> Result<()>;
    fn harvest(&mut self) -> Result<()>;
    fn free_funds(&mut self, amount: u64) -> Result<()>;

    fn strategy_type(&self) -> StrategyType;
    fn seeds(&self) -> [&[u8]; 3];
    fn key(&self) -> Pubkey {
        let seeds = self.seeds();
        Pubkey::create_program_address(&seeds, &crate::id()).unwrap()
    }
    fn token_account(&self) -> Pubkey;

    // getters
    /// Returns the total funds in the strategy, this value is affected by gains and losses
    fn total_assets(&self) -> u64;
    fn available_deposit(&self) -> u64;
    fn available_withdraw(&self) -> u64;
}

// Helper trait to enable cloning of Box<dyn Strategy>
// pub trait StrategyClone {
//     fn clone_box(&self) -> Box<dyn Strategy>;
// }

// impl<T> StrategyClone for T
// where
//     T: 'static + Strategy + Clone,
// {
//     fn clone_box(&self) -> Box<dyn Strategy> {
//         Box::new(self.clone())
//     }
// }

// impl Clone for Box<dyn Strategy> {
//     fn clone(&self) -> Box<dyn Strategy> {
//         (**self).clone_box()
//     }
// }

pub trait StrategyInfo {
    fn available_withdraw() -> u64;
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
            StrategyType::TradeFintech => b"trade_fintech".to_vec(),
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