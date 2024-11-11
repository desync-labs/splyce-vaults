use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Config {
    pub owner: Pubkey,
}
