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

declare_id!("8eDcyX8Z8yZXBQsuatwxDC1qzGbuUbP7wGERDBQoPmBH");

#[program]
pub mod tokenized_vault {
    use super::*;

    pub fn init_vault(ctx: Context<Initialize>, index: u64, config: VaultConfig) -> Result<()> {
        handle_init_vault(ctx, index, config)
    }

    pub fn init_role_admin(ctx: Context<InitializeRoleAdmin>) -> Result<()> {
        handle_init_role_admin(ctx)
    }

    pub fn set_role(ctx: Context<SetRole>, role: Role, user: Pubkey) -> Result<()> {
        handle_set_role(ctx, role, user)
    }

    pub fn drop_role(ctx: Context<DropRole>, role: Role) -> Result<()> {
        handle_drop_role(ctx, role)
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

    pub fn remove_strategy(ctx: Context<RemoveStrategy>, strategy: Pubkey, force: bool) -> Result<()> {
        handle_remove_strategy(ctx, strategy, force)
    }

    pub fn update_debt<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, UpdateStrategyDebt<'info>>, 
        amount: u64
    ) -> Result<()> {
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