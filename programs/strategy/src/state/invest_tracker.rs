use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct InvestTracker {
    pub amount_invested: u64,
    pub amount_withdrawn: u64,
    pub asset_amount: u64,
    pub asset_price: u64,
    pub a_to_b_for_purchase: bool,
}   
