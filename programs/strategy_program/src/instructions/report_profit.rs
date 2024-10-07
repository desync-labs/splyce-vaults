use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::utils::strategy;
use crate::error::ErrorCode;
use crate::constants::UNDERLYING_SEED;

#[derive(Accounts)]
pub struct ReportProfit<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,
    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), strategy.key().as_ref()], bump)]
    pub underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_report_profit<'info>(ctx: Context<'_, '_, '_, 'info, ReportProfit<'info>>, profit: u64) -> Result<()> {
    let mut strategy = strategy::from_acc_info(&ctx.accounts.strategy)?;

    if ctx.accounts.signer.key() != strategy.manager() {
        return Err(ErrorCode::AccessDenied.into());
    }

    strategy.report_profit(&ctx.accounts, &ctx.remaining_accounts, profit)?;
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])
}