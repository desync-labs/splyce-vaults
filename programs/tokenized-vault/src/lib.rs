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

    pub fn add_strategy(
        ctx: Context<AddStrategy>, 
        strategy_type: StrategyType, 
        config_data: Vec<u8> // Serialized configuration data
    ) -> Result<()> {
        add_strategy::handler(
            ctx, 
            strategy_type, 
            config_data
        )
    }

    pub fn allocate(
        ctx: Context<AllocateToStrategy>,
        amount: u64
    ) -> Result<()> {
        allocate::handler(ctx, amount)
    }
}

