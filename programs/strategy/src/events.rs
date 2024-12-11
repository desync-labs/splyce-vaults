use anchor_lang::prelude::*;

#[event]
pub struct StrategyInitEvent {
    pub account_key: Pubkey,
    pub strategy_type: String,
    pub vault: Pubkey,
    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    pub underlying_decimals: u8,
    pub deposit_limit: u64,
    pub deposit_period_ends: i64,
    pub lock_period_ends: i64,
}

#[event]
pub struct StrategyDepositEvent {
    pub account_key: Pubkey,
    pub amount: u64,
    pub total_assets: u64,
}

#[event]
pub struct StrategyWithdrawEvent {
    pub account_key: Pubkey,
    pub amount: u64,
    pub total_assets: u64,
}

#[event]
pub struct SetPerformanceFeeEvent {
    pub account_key: Pubkey,
    pub fee: u64,
}

#[event]
pub struct HarvestAndReportDTFEvent {
    pub account_key: Pubkey,
    pub total_assets: u64,
    pub timestamp: i64,
}

#[event]
pub struct InvestTrackerSwapEvent {
    pub account_key: Pubkey,
    pub invest_tracker_account_key: Pubkey,
    pub asset_mint: Pubkey,
    pub invested_underlying_amount: u64,
    pub asset_amount: u64,
    pub asset_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct InvestTrackerUpdateEvent {
    pub account_key: Pubkey,
    pub invest_tracker_account_key: Pubkey,
    pub whirlpool_id: Pubkey,
    pub asset_mint: Pubkey,
    pub amount_invested: u64,
    pub amount_withdrawn: u64,
    pub asset_amount: u64,
    pub asset_price: u128,
    pub sqrt_price: u128,
    pub asset_value: u128,
    pub asset_decimals: u8,
    pub underlying_decimals: u8,
    pub a_to_b_for_purchase: bool,
    pub assigned_weight: u16,
    pub current_weight: u16,
    pub timestamp: i64,
}

#[event]
pub struct StrategyDeployFundsEvent {
    pub account_key: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct StrategyFreeFundsEvent {
    pub account_key: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}