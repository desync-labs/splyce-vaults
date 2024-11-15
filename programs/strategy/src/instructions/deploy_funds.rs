use anchor_lang::prelude::*;
use anchor_spl::{
    token::Token,
    token_interface::TokenAccount,
};

use crate::utils::unchecked_strategy::UncheckedStrategy;
use crate::error::ErrorCode;
use crate::constants::UNDERLYING_SEED;

#[derive(Accounts)]
pub struct DeployFunds<'info> {
    /// CHECK: can be any strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,

    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), strategy.key().as_ref()], bump)]
    pub underlying_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_deploy_funds<'info>(ctx: Context<'_, '_, '_, 'info, DeployFunds<'info>>, amount: u64) -> Result<()> {
    let mut strategy = ctx.accounts.strategy.from_unchecked()?;

    if *ctx.accounts.signer.key != strategy.manager() {
        return Err(ErrorCode::AccessDenied.into());
    }
    
    strategy.deploy_funds(&ctx.accounts, &ctx.remaining_accounts, amount)?;
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])
}