use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct FaucetData {
    pub decimals: u8,
    pub amount: u64,
    pub owner: Pubkey,
}