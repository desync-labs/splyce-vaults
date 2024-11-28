use anchor_lang::prelude::*;
use anchor_spl::{
    token::Token,
    token_interface::TokenAccount,
};

use crate::utils::unchecked_strategy::UncheckedStrategy;
use crate::error::ErrorCode;
use crate::constants::UNDERLYING_SEED;
use crate::state::StrategyType;

#[derive(Accounts)]
pub struct OrcaPurchaseAssets<'info> {
    /// CHECK: can be any strategy but would be checked by handle_orca_purchase_assets if not orca_strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,

    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), strategy.key().as_ref()], bump)]
    pub underlying_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_orca_purchase_assets<'info>(ctx: Context<'_, '_, '_, 'info, OrcaPurchaseAssets<'info>>, amount: u64) -> Result<()> {
    let mut strategy = ctx.accounts.strategy.from_unchecked()?;
    let strategy_type = strategy.strategy_type();
    if strategy_type != StrategyType::Orca {
        return Err(ErrorCode::InvalidStrategyType.into());
    }

    if *ctx.accounts.signer.key != strategy.manager() {
        return Err(ErrorCode::AccessDenied.into());
    }
    
    strategy.orca_purchase_assets(&ctx.accounts, &ctx.remaining_accounts, amount)?;
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])
}