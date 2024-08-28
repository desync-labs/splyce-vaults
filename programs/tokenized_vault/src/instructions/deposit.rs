use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, MintTo, Token, TokenAccount, Transfer},
};

use crate::state::*;
use crate::error::ErrorCode::*;
use crate::utils::token::*;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub shares_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_shares_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    // todo: track min user deposit properly

    if vault.is_shutdown == true {
        return Err(VaultShutdown.into());
    }
    if amount == 0 {
        return Err(ZeroValue.into());
    }
    if amount < vault.min_user_deposit {
        return Err(MinDepositNotReached.into());
    }

    // todo: introduce deposit limit module
    if amount > vault.max_deposit() {
        return Err(ExceedDepositLimit.into());
    }

    transfer_token_to(
        ctx.accounts.token_program.to_account_info(), 
        ctx.accounts.user_token_account.to_account_info(), 
        ctx.accounts.vault_token_account.to_account_info(), 
        ctx.accounts.user.to_account_info(), 
        amount
    )?;

    // Calculate shares to mint
    let shares = vault.convert_to_shares(amount);

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            MintTo {
                mint: ctx.accounts.shares_mint.to_account_info(),
                to: ctx.accounts.user_shares_account.to_account_info(),
                authority: vault.to_account_info(),
            }, 
            &[&vault.seeds()]
        ), 
        shares
    )?;

    // Update balances
    vault.handle_deposit(amount, shares);

    Ok(())
}