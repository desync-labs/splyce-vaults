pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;
pub mod events;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("EDA9ee5UKzdqrHgSd5v64bNnbCae1t7NJfUpvS7DZod");

// we need to define a trait for the strategies
// they aren't defined otherwise, because we work with unchecked accounts
#[derive(Accounts)]
pub struct RegAcc<'info> {
    #[account()]
    pub simple_strategy: Account<'info, SimpleStrategy>,
    #[account()]
    pub tf_strategy: Account<'info, TradeFintechStrategy>,
}

#[program]
pub mod strategy {
    use super::*;

    // the only reason we need this is to keep accounts in the idl file
    pub fn register_accounts(_ctx: Context<RegAcc>) -> Result<()> {
        Ok(())
    }

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        handle_initialize(ctx)
    }

    pub fn init_strategy(ctx: Context<InitStrategy>, index: u8, strategy_type: StrategyType, config: Vec<u8>) -> Result<()> {
        handle_init_strategy(ctx, index, strategy_type, config)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        handle_deposit(ctx, amount)
    }

    pub fn withdraw<'info>(ctx:  Context<'_, '_, '_, 'info, Withdraw<'info>>, amount: u64) -> Result<()> {
        handle_withdraw(ctx, amount)
    }

    pub fn report<'info>(ctx: Context<'_, '_, '_, 'info, Report<'info>>) -> Result<()> {
        handle_report(ctx)
    }

    pub fn report_profit<'info>(ctx: Context<'_, '_, '_, 'info, ReportProfit<'info>>, profit: u64) -> Result<()> {
        handle_report_profit(ctx, profit)
    }

    pub fn report_loss<'info>(ctx: Context<'_, '_, '_, 'info, ReportLoss<'info>>, loss: u64) -> Result<()> {
        handle_report_loss(ctx, loss)
    }

    pub fn transfer_management(ctx: Context<TransferManagement>, new_admin: Pubkey) -> Result<()> {
        handle_transfer_management(ctx, new_admin)
    }

    pub fn set_performance_fee(ctx: Context<SetPerformanceFee>, fee: u64) -> Result<()> {
        handle_set_performance_fee(ctx, fee)
    }

    pub fn set_fee_manager(ctx: Context<SetFeeManager>, recipient: Pubkey) -> Result<()> {
        handle_set_fee_manager(ctx, recipient)
    }

    pub fn withdraw_fee<'info>(ctx:  Context<'_, '_, '_, 'info, WithdrawFee<'info>>, amount: u64) -> Result<()> {
        handle_withdraw_fee(ctx, amount)
    }

    pub fn deploy_funds<'info>(ctx:  Context<'_, '_, '_, 'info, DeployFunds<'info>>, amount: u64) -> Result<()> {
        handle_deploy_funds(ctx, amount)
    }
}