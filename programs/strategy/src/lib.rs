pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("FdFSegudTdDtCB8QvUN1FVLe6YpcCCLu5e1aJoiqAdtZ");

// we need to define a trait for the strategies
// they aren't defined otherwise, because we work with unchecked accounts
#[derive(Accounts)]
#[instruction(strategy_type: StrategyType)]pub struct RegAcc<'info> {
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
        instructions::initialize(ctx, strategy_type, config)
    }

    pub fn deposit_funds(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        deposit::handle_deposit(&ctx, amount)
    }

    pub fn withdraw_funds(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        withdraw::handle_withdraw(&ctx, amount)
    }

    pub fn report(ctx: Context<Report>) -> Result<()> {
        report::handle_report(ctx)
    }
}