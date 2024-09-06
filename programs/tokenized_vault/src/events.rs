use anchor_lang::prelude::*;

#[event]
pub struct VaultInitEvent {
    pub vault_index: [u8; 8],
    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    pub underlying_decimals: u8,
    pub deposit_limit: u64,
    pub min_user_deposit: u64,
}

#[event]
pub struct VaultAddStrategyEvent {
    pub vault_index: [u8; 8],
    pub strategy_key: Pubkey,
    pub current_debt: u64,
    pub max_debt: u64,
    pub last_update: i64,
    pub is_active: bool,    
}

#[event]
pub struct VaultDepositEvent {
    pub vault_index: [u8; 8],
    pub amount: u64,
    pub share: u64,
}