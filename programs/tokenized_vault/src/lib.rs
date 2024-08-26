pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use state::*;
pub use instructions::*;
// pub use utils::*;

declare_id!("8eDcyX8Z8yZXBQsuatwxDC1qzGbuUbP7wGERDBQoPmBH");

#[program]
pub mod tokenized_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        handle_initialize(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        handle_deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        handle_withdraw(ctx, shares)
    }

    pub fn add_strategy(ctx: Context<AddStrategy>) -> Result<()> {
        handle_add_strategy(ctx)
    }

    pub fn allocate(
        ctx: Context<AllocateToStrategy>,
        amount: u64
    ) -> Result<()> {
        handle_allocate(ctx, amount)
    }

    pub fn deallocate(
        ctx: Context<DeallocateFromStrategy>,
        amount: u64
    ) -> Result<()> {
        handle_deallocate(ctx, amount)
    }

    pub fn set_deposit_limit(ctx: Context<SetDepositLimit>, limit: u64) -> Result<()> {
        handle_set_deposit_limit(ctx, limit)
    }
}

