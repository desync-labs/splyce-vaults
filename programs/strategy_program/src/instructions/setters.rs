use anchor_lang::prelude::*;

use crate::events::SetPerformanceFeeEvent;
use crate::utils::strategy;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct SetPerformanceFee<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetFeeManager<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handle_set_performance_fee<'info>(ctx: Context<SetPerformanceFee<'info>>, new_fee: u64) -> Result<()> {
    let mut strategy = strategy::from_acc_info(&ctx.accounts.strategy)?;

    if *ctx.accounts.signer.key != strategy.manager() {
        return Err(ErrorCode::AccessDenied.into());
    }
    
    let fee_data = &mut strategy.fee_data();
    fee_data.set_performance_fee(new_fee)?;

    emit!(SetPerformanceFeeEvent {
        account_key: strategy.key(),
        fee: new_fee,
    });

    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])
   
}

pub fn handle_set_fee_manager<'info>(ctx: Context<SetFeeManager<'info>>, recipient: Pubkey) -> Result<()> {
    let mut strategy = strategy::from_acc_info(&ctx.accounts.strategy)?;

    if *ctx.accounts.signer.key != strategy.manager() {
        return Err(ErrorCode::AccessDenied.into());
    }

    let fee_data = &mut strategy.fee_data();
    fee_data.set_fee_manager(recipient)?;
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])
}