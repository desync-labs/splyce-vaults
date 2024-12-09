use access_control::{
    constants::USER_ROLE_SEED,
    program::AccessControl,
    state::Role
};
use anchor_lang::prelude::*;
use anchor_spl::{
    token::Token,
    token_interface::{Mint, TokenAccount, TokenInterface}
};

use crate::constants::{SHARES_SEED, UNDERLYING_SEED, WHITELISTED_SEED};

use crate::events::VaultDepositEvent;
use crate::state::Vault;
use crate::utils::{token, vault};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,

    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, seeds = [SHARES_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub shares_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, address = vault.load()?.underlying_mint)]
    pub underlying_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub user_shares_account: InterfaceAccount<'info, TokenAccount>,

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
    pub kyc_verified: UncheckedAccount<'info>,

    /// CHECK: this account may not exist
    #[account(
        seeds = [
            WHITELISTED_SEED.as_bytes(), 
            vault.key().as_ref(),
            user.key().as_ref(),
        ], 
        bump,
    )]
    pub whitelisted: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub user: Signer<'info>,

    pub shares_token_program: Program<'info, Token>,
    pub token_program: Interface<'info, TokenInterface>,
    pub access_control: Program<'info, AccessControl>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    vault::validate_deposit(
        &ctx.accounts.vault, 
        ctx.accounts.kyc_verified.to_account_info(),
        ctx.accounts.whitelisted.to_account_info(),
        false,
        amount
    )?;

    let shares = ctx.accounts.vault.load()?.convert_to_shares(amount);

    token::transfer(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.user_token_account.to_account_info(),
        ctx.accounts.vault_token_account.to_account_info(),
        ctx.accounts.user.to_account_info(),
        &ctx.accounts.underlying_mint,
        amount,
    )?;

    token::mint_to(
        ctx.accounts.shares_token_program.to_account_info(),
        ctx.accounts.shares_mint.to_account_info(),
        ctx.accounts.user_shares_account.to_account_info(),
        ctx.accounts.shares_mint.to_account_info(),
        shares,
        &ctx.accounts.vault.load()?.seeds_shares(),
    )?;

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