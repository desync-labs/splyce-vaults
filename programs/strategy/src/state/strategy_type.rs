use anchor_lang::prelude::*;
use crate::constants::DISCRIMINATOR_LEN;

use crate::state::{
    simple_strategy::SimpleStrategy,
    trade_fintech_srategy::TradeFintechStrategy,
};

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