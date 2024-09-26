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

declare_id!("ErJGueTn3xVKETP4dc8vrmS5Lu7iupJZ2pr7kYJkCtUE");

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

    pub fn initialize(ctx: Context<Initialize>, strategy_type: StrategyType, config: Vec<u8>) -> Result<()> {
        initialize::initialize(ctx, strategy_type, config)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        deposit::handle_deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        withdraw::handle_withdraw(ctx, amount)
    }

    pub fn report(ctx: Context<Report>) -> Result<()> {
        report::handle_report(ctx)
    }

    pub fn transfer_management(ctx: Context<TransferManagement>, new_admin: Pubkey) -> Result<()> {
        transfer_management::handle_transfer_management(ctx, new_admin)
    }

    pub fn set_performance_fee(ctx: Context<SetPerformanceFee>, fee: u64) -> Result<()> {
        setters::handle_set_performance_fee(ctx, fee)
    }

    pub fn set_fee_manager(ctx: Context<SetFeeManager>, recipient: Pubkey) -> Result<()> {
        setters::handle_set_fee_manager(ctx, recipient)
    }

    pub fn withdraw_fee(ctx: Context<WithdrawFee>, amount: u64) -> Result<()> {
        withdraw_fee::handle_withdraw_fee(ctx, amount)
    }
}