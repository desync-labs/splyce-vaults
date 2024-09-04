use anchor_lang::prelude::*;

#[event]
pub struct VaultInitEvent {
    pub event_id: [u8 ; 8],    
    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    pub underlying_decimals: u8,
    pub deposit_limit: u64,
    pub min_user_deposit: u64,
}