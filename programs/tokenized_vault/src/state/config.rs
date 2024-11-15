use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct Config {
    pub next_vault_index: u64,
}

