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
#[instruction(strategy_type: StrategyType)]
pub struct RegAcc<'info> {
    #[account()]
    pub simple_strategy: Account<'info, SimpleStrategy>,
    #[account()]
    pub tf_strategy: Account<'info, TradeFintechStrategy>,
}

#[program]
pub mod strategy_program {
    use super::*;

    // the only reason we need this is to keep accounts in the idl file
    pub fn register_accounts(_ctx: Context<RegAcc>) -> Result<()> {
        Ok(())
    }

    pub fn init_strategy(ctx: Context<Initialize>, index: u8, strategy_type: StrategyType, config: Vec<u8>) -> Result<()> {
        handle_init_strategy(ctx, index, strategy_type, config)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        handle_deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        handle_withdraw(ctx, amount)
    }

    pub fn report(ctx: Context<Report>) -> Result<()> {
        handle_report(ctx)
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

    pub fn withdraw_fee(ctx: Context<WithdrawFee>, amount: u64) -> Result<()> {
        handle_withdraw_fee(ctx, amount)
    }
}