use anchor_lang::prelude::*;

#[derive(Debug, AnchorDeserialize, AnchorSerialize)]
pub struct TokenMetaData {
    pub name: String,
    pub symbol: String,
}

#[derive(Debug, AnchorDeserialize, AnchorSerialize)]
pub struct TokenData {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub decimals: u8,
    pub metadata: TokenMetaData,
}

#[event]
pub struct VaultInitEvent {
    pub vault_key: Pubkey, 
    pub underlying_token: TokenData,
    pub share_token: TokenData,
    pub deposit_limit: u64,
    pub min_user_deposit: u64,
    pub performance_fee: u64,
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
    pub total_debt: u64,
    pub total_idle: u64,
    pub total_share: u64,
    pub amount: u64,
    pub share: u64,
    pub token_account: Pubkey,
    pub share_account: Pubkey,
    pub token_mint: Pubkey,
    pub share_mint: Pubkey,
    pub authority: Pubkey,
}


#[event]
pub struct VaultWithdrawlEvent {
    pub vault_index: [u8; 8],
    pub total_idle: u64,
    pub total_share: u64,
    pub assets_to_transfer: u64,
    pub shares_to_burn: u64,
    pub token_account: Pubkey,
    pub share_account: Pubkey,
    pub token_mint: Pubkey,
    pub share_mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct VaultUpdateDepositLimitEvent {
    pub vault_index: [u8; 8],
    pub new_limit: u64,
}

#[event]
pub struct VaultShutDownEvent {
    pub vault_index: [u8; 8],
    pub shutdown: bool,
}

#[event]
pub struct UpdatedCurrentDebtForStrategyEvent {
    pub vault_index: [u8; 8],
    pub strategy_key: Pubkey,
    pub total_idle: u64,
    pub total_debt: u64,
    pub new_debt: u64,
}

#[event]
pub struct StrategyReportedEvent {
    pub strategy_key: Pubkey,
    pub gain: u64,
    pub loss: u64,
    pub current_debt: u64,
    pub protocol_fees: u64,
    pub total_fees: u64,
    pub timestamp: i64,
}