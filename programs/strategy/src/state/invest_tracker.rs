use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct InvestTracker {
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
    pub assigned_weight: u8,
    //later add last_updated_timestamp so that the actions happen when the price is fresh
}   
