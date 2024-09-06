use anchor_lang::prelude::*;

#[event]
pub struct StrategyInitEvent {
    pub account_key: Pubkey,
    pub strategy_type: String,
    pub vault: Pubkey,
    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    pub undelying_decimals: u8,
    pub total_idle: u64,
    pub total_funds: u64,
    pub deposit_limit: u64,
    pub deposit_period_ends: u64,
    pub lock_period_ends: u64,
}

#[event]
pub struct StrategyDepositEvent {
    pub account_key: Pubkey,
    pub amount: u64,
    pub total_funds: u64,
}

#[event]
pub struct StrategyWithdrawEvent {
    pub account_key: Pubkey,
    pub amount: u64,
    pub total_funds: u64,
}