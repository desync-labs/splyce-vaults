use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::fee_data;
use crate::utils::strategy;
use crate::error::ErrorCode;
use crate::constants::FEE_BPS;

#[derive(Accounts)]
pub struct Report<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_report<'info>(ctx: Context<Report<'info>>) -> Result<()> {
    let mut strategy = strategy::from_acc_info(&ctx.accounts.strategy)?;

    if ctx.accounts.signer.key() != strategy.manager() {
        return Err(ErrorCode::AccessDenied.into());
    }

    let old_total_assets = strategy.total_assets();
    let new_total_assets = strategy.harvest_and_report(ctx.remaining_accounts)?;

    if new_total_assets > old_total_assets {
        let profit = new_total_assets - old_total_assets;
        let fee_data = strategy.fee_data();

        if fee_data.performance_fee > 0 {
            let fees = (profit * fee_data.performance_fee) / FEE_BPS;
            fee_data.fee_balance += fees;
    
            strategy.set_total_assets(new_total_assets - fees);
            return strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..]);
        }
    }

    strategy.set_total_assets(new_total_assets);
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])
}