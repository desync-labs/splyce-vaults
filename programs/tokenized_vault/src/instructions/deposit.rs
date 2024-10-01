use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::constants::{ROLES_SEED, SHARES_SEED, UNDERLYING_SEED};

use crate::events::VaultDepositEvent;
use crate::state::*;
use crate::error::ErrorCode;
use crate::utils::token::*;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(seeds = [ROLES_SEED.as_bytes(), user.key().as_ref()], bump)]
    pub roles: Account<'info, AccountRoles>,

    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [SHARES_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub shares_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_shares_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = roles.is_whitelisted)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
   let shares = handle_deposit_internal(&ctx.accounts.vault, amount)?;

    transfer_token_to(
        ctx.accounts.token_program.to_account_info(), 
        ctx.accounts.user_token_account.to_account_info(), 
        ctx.accounts.vault_token_account.to_account_info(), 
        ctx.accounts.user.to_account_info(), 
        amount
    )?;

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            MintTo {
                mint: ctx.accounts.shares_mint.to_account_info(),
                to: ctx.accounts.user_shares_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            }, 
            &[&ctx.accounts.vault.load()?.seeds()]
        ), 
        shares
    )?;

    let vault = ctx.accounts.vault.load()?;
    emit!(VaultDepositEvent {
        vault_index: vault.index_buffer,
        total_debt: vault.total_debt,
        total_idle: vault.total_idle,
        total_share: vault.total_shares,
        amount,
        share: shares,
        token_account: ctx.accounts.user_token_account.to_account_info().key(),
        share_account: ctx.accounts.user_shares_account.to_account_info().key(),
        authority: ctx.accounts.user.to_account_info().key(),
    });

    Ok(())
}

/// returns shares to mint
fn handle_deposit_internal<'info>(vault_loader: &AccountLoader<'info, Vault>, amount: u64) -> Result<u64> {
    let mut vault = vault_loader.load_mut()?;
    // todo: track min user deposit properly
    if vault.is_shutdown == true {
        return Err(ErrorCode::VaultShutdown.into());
    }

    if amount == 0 {
        return Err(ErrorCode::ZeroValue.into());
    }
    
    if amount < vault.min_user_deposit {
        return Err(ErrorCode::MinDepositNotReached.into());
    }

    // todo: introduce deposit limit module
    if amount > vault.max_deposit() {
        return Err(ErrorCode::ExceedDepositLimit.into());
    }

    // Calculate shares to mint
    let shares = vault.convert_to_shares(amount);

    vault.handle_deposit(amount, shares);

    Ok(shares)
}