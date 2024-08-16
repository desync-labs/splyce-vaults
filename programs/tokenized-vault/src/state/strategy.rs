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

impl Owner for StrategyEnum {
    fn owner() -> Pubkey {
        OWNER_PUBKEY
    }
}

impl AccountSerialize for StrategyEnum {
    fn try_serialize<W: std::io::Write>(&self, writer: &mut W) -> std::result::Result<(), AnchorError> {
        match self {
            StrategyEnum::TradeFintechStrategy(strategy) => strategy.try_serialize(writer),
            // StrategyEnum::ConcreteStrategy2(strategy) => strategy.try_serialize(writer),
            // Add other strategies here
        }
    }
}

impl AccountDeserialize for StrategyEnum {
    fn try_deserialize(buf: &mut &[u8]) -> std::result::Result<Self, AnchorError> {
        // Implement deserialization logic based on the strategy type
        // For example, you might need to read a type identifier first
        // and then deserialize the appropriate strategy
        unimplemented!()
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> std::result::Result<Self, AnchorError> {
        // Implement unchecked deserialization logic
        unimplemented!()
    }
}

impl Strategy for StrategyEnum {
    fn deposit(&mut self, amount: u64) -> Result<()> {
        match self {
            StrategyEnum::TradeFintechStrategy(strategy) => strategy.deposit(amount),
            // StrategyEnum::ConcreteStrategy2(strategy) => strategy.some_strategy_method(),
            // Add other strategies here
        }
    }

    fn withdraw(&mut self, amount: u64) -> Result<()> {
        match self {
            StrategyEnum::TradeFintechStrategy(strategy) => strategy.withdraw(amount),
            // StrategyEnum::ConcreteStrategy2(strategy) => strategy.some_strategy_method(),
            // Add other strategies here
        }
    }

    fn harvest(&mut self) -> Result<()> {
        match self {
            StrategyEnum::TradeFintechStrategy(strategy) => strategy.harvest(),
            // StrategyEnum::ConcreteStrategy2(strategy) => strategy.some_strategy_method(),
            // Add other strategies here
        }
    }

    fn available_deposit(&self) -> Result<u64> {
        match self {
            StrategyEnum::TradeFintechStrategy(strategy) => strategy.available_deposit(),
            // StrategyEnum::ConcreteStrategy2(strategy) => strategy.some_strategy_method(),
            // Add other strategies here
        }
    }

    fn available_withdraw(&self) -> Result<u64> {
        match self {
            StrategyEnum::TradeFintechStrategy(strategy) => strategy.available_withdraw(),
            // StrategyEnum::ConcreteStrategy2(strategy) => strategy.some_strategy_method(),
            // Add other strategies here
        }
    }

    fn owner(&self) -> Pubkey {
        match self {
            StrategyEnum::TradeFintechStrategy(strategy) => strategy.owner(),
            // StrategyEnum::ConcreteStrategy2(strategy) => strategy.owner(),
            // Add other strategies here
        }
    }

    fn key(&self) -> Pubkey {
        match self {
            StrategyEnum::TradeFintechStrategy(strategy) => strategy.key(),
            // StrategyEnum::ConcreteStrategy2(strategy) => strategy.key(),
            // Add other strategies here
        }
    }
}

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