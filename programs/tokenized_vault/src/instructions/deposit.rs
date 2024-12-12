use access_control::state::UserRole;
use access_control::{
    constants::USER_ROLE_SEED,
    program::AccessControl,
    state::Role
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{SHARES_SEED, UNDERLYING_SEED, USER_DATA_SEED};

use crate::events::VaultDepositEvent;
use crate::state::{UserData, Vault};
use crate::utils::{token, vault};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [SHARES_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub shares_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_shares_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed, 
        payer = user,
        space = UserData::LEN,
        seeds = [
            USER_DATA_SEED.as_bytes(), 
            vault.key().as_ref(), 
            user.key().as_ref()
        ], 
        bump
        )]
    pub user_data: Account<'info, UserData>,  

    /// CHECK: this account may not exist
    #[account(
        seeds = [
            USER_ROLE_SEED.as_bytes(), 
            user.key().as_ref(),
            Role::KYCVerified.to_seed().as_ref()
        ], 
        bump,
        seeds::program = access_control.key()
    )]
    pub kyc_verified: Account<'info, UserRole>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub access_control: Program<'info, AccessControl>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    vault::validate_deposit(
        &ctx.accounts.vault, 
        &ctx.accounts.kyc_verified,
        &ctx.accounts.user_data,
        false,
        amount
    )?;

    let shares = ctx.accounts.vault.load()?.convert_to_shares(amount);

    token::transfer(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.user_token_account.to_account_info(),
        ctx.accounts.vault_token_account.to_account_info(),
        ctx.accounts.user.to_account_info(),
        amount,
    )?;

    token::mint_to(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.shares_mint.to_account_info(),
        ctx.accounts.user_shares_account.to_account_info(),
        ctx.accounts.shares_mint.to_account_info(),
        shares,
        &ctx.accounts.vault.load()?.seeds_shares(),
    )?;

    ctx.accounts.user_data.deposited += amount;

    let mut vault = ctx.accounts.vault.load_mut()?;
    vault.handle_deposit(amount, shares);

    emit!(VaultDepositEvent {
        vault_key: vault.key,
        total_debt: vault.total_debt,
        total_idle: vault.total_idle,
        total_share: vault.total_shares(),
        amount,
        share: shares,
        token_account: ctx.accounts.user_token_account.to_account_info().key(),
        share_account: ctx.accounts.user_shares_account.to_account_info().key(),
        token_mint: ctx.accounts.vault_token_account.mint,
        share_mint: ctx.accounts.shares_mint.to_account_info().key(),
        authority: ctx.accounts.user.to_account_info().key(),
    });

    Ok(())
}