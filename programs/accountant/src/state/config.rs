use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct Config {
    pub next_accountant_index: u64,
    pub admin: Pubkey,
}

