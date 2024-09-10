use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::utils::strategy;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct TransferManagement<'info> {
    /// CHECK: can by any strategy
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_transfer_management<'info>(ctx: Context<TransferManagement<'info>>, new_manager: Pubkey) -> Result<()> {
    let mut strategy = strategy::from_acc_info(&ctx.accounts.strategy)?;

    if *ctx.accounts.signer.key != strategy.manager() {
        return Err(ErrorCode::AccessDenied.into());
    }

    strategy.set_manager(new_manager);
    strategy.save_changes(&mut &mut ctx.accounts.strategy.try_borrow_mut_data()?[8..])
}