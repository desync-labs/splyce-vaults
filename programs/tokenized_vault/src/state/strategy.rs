use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

use crate::state::TradeFintechStrategy;
use anchor_lang::error::Error as AnchorError;
// use crate::constants::STRATEGY_SEED;

// #[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub trait Strategy {  
    fn deposit(&mut self, amount: u64) -> Result<()>;
    fn withdraw(&mut self, amount: u64) -> Result<()>;
    fn harvest(&mut self) -> Result<()>;
    fn available_deposit(&self) -> Result<u64>;
    fn available_withdraw(&self) -> Result<u64>;
    fn owner(&self) -> Pubkey;
    // fn get_strategy_type(&self) -> StrategyType;
    // fn seeds(&self) -> [&[u8]];
    fn key(&self) -> Pubkey;
    // fn create_signer_seeds(&self) -> Result<Vec<Vec<u8>>>;
    // fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
    //     Ok(())
    // }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum StrategyEnum {
    TradeFintechStrategy(TradeFintechStrategy),
    // ConcreteStrategy2(ConcreteStrategy2),
    // Add other strategies here
}

impl Discriminator for StrategyEnum {
    const DISCRIMINATOR: [u8; 8] = *b"strategy";
}

const OWNER_PUBKEY: Pubkey = Pubkey::new_from_array([0; 32]); // Replace with the actual owner's public key


#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum StrategyType {
    TradeFintech,
    RWA,
    Lending,
    Liquidation,
    Investor,
}

impl StrategyType {
    pub fn to_seed(&self) -> Vec<u8> {
        match self {
            StrategyType::TradeFintech => b"trade_fintech".to_vec(),
            StrategyType::RWA => b"rwa".to_vec(),
            StrategyType::Lending => b"lending".to_vec(),
            StrategyType::Liquidation => b"liquidation".to_vec(),
            StrategyType::Investor => b"investor".to_vec(),
        }
    }
}