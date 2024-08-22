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

declare_id!("8eDcyX8Z8yZXBQsuatwxDC1qzGbuUbP7wGERDBQoPmBH");

#[program]
pub mod tokenized_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        deposit::handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        withdraw::handler(ctx, shares)
    }

    pub fn add_strategy(ctx: Context<AddStrategy>) -> Result<()> {
        add_strategy::handler(ctx)
    }

    pub fn allocate(
        ctx: Context<AllocateToStrategy>,
        amount: u64
    ) -> Result<()> {
        allocate::handler(ctx, amount)
    }

    pub fn deallocate(
        ctx: Context<DeallocateFromStrategy>,
        amount: u64
    ) -> Result<()> {
        deallocate::handler(ctx, amount)
    }
}

