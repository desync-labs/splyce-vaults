use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct Config {
    pub next_strategy_index: u64,
}

