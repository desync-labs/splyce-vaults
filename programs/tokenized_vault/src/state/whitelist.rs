use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};

#[account]
#[derive(Default, Debug)]
pub struct Whitelist {
    pub whitelisted_account: Pubkey,
}

impl Whitelist {
    pub const LEN: usize = 8 + 32;
}