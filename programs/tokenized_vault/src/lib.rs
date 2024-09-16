pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;
pub mod events;

use anchor_lang::prelude::*;

pub use constants::*;
pub use state::*;
pub use instructions::*;
// pub use utils::*;

declare_id!("CNyqz3mqw6koNmAe7rn2xHGHAS9ftXUNQohwHSiXhJLQ");

#[program]
pub mod tokenized_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, index: u64) -> Result<()> {
        handle_initialize(ctx, index)
    }

    pub fn init_roles(ctx: Context<InitializeRoles>) -> Result<()> {
        handle_init_roles(ctx)
    }

    pub fn set_role(ctx: Context<SetRole>, role: Role, key: Pubkey) -> Result<()> {
        handle_set_role(ctx, role, key)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        handle_deposit(ctx, amount)
    }

    pub fn withdraw<'info>(
        ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>, 
        shares: u64, 
        max_loss: u64,
        remaining_accounts_map: AccountsMap
    ) -> Result<()> {
        handle_redeem(ctx, shares, max_loss, remaining_accounts_map)
    }

    pub fn add_strategy(ctx: Context<AddStrategy>, max_debt: u64) -> Result<()> {
        handle_add_strategy(ctx, max_debt)
    }

    pub fn update_debt(ctx: Context<UpdateStrategyDebt>, amount: u64) -> Result<()> {
        handle_update_debt(ctx, amount)
    }

    pub fn set_deposit_limit(ctx: Context<SetDepositLimit>, limit: u64) -> Result<()> {
        handle_set_deposit_limit(ctx, limit)
    }

    pub fn process_report(ctx: Context<ProcessReport>) -> Result<()> {
        handle_process_report(ctx)
    }

    pub fn shutdown_vault(ctx: Context<ShutdownVault>) -> Result<()> {
        handle_shutdown_vault(ctx)
    }
}

