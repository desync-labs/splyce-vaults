use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};

use crate::state::*;
use crate::utils::token::*;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,
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

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;
    
    // Calculate shares to mint
    let shares = ctx.accounts.vault.load()?.convert_to_shares(amount);

    // Mint shares to user
    let cpi_accounts = MintTo {
        mint: ctx.accounts.shares_mint.to_account_info(),
        to: ctx.accounts.user_shares_account.to_account_info(),
        authority: ctx.accounts.vault.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = 
    token::mint_to(
        // CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), 
        CpiContext::new_with_signer(cpi_program, cpi_accounts, &[&ctx.accounts.vault.load()?.seeds()]), 
        shares
    )?;
    // Update balances

    let mut vault = ctx.accounts.vault.load_mut()?;
    
    vault.total_debt += amount;
    vault.total_shares += shares;

    Ok(())
}
