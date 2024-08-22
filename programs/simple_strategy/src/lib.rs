pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;
// pub use utils::*;

declare_id!("BVrHM7hgxz2EN94zQuSPvQT2fE8aDNS16mmsfTP1xWMJ");

#[program]
pub mod simple_strategy {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, vault: Pubkey, deposit_limit: u64) -> Result<()> {
        initialize::handler(ctx, vault, deposit_limit)
    }

    pub fn deposit_funds(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        withdraw::handler(ctx, shares)
    }
}

