use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct InvestTracker {
    pub amount_invested: u64,
    pub asset_amount: u64,
}   
