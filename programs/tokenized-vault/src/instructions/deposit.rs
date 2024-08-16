use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, MintTo, Token, TokenAccount, Transfer},
};

use crate::state::*;

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

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(), 
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            }
        ), 
        amount)?;
    
    // Calculate shares to mint
    let shares = ctx.accounts.vault.convert_to_shares(amount);

    // Mint shares to user
    let cpi_accounts = MintTo {
        mint: ctx.accounts.shares_mint.to_account_info(),
        to: ctx.accounts.user_shares_account.to_account_info(),
        authority: ctx.accounts.vault.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::mint_to(
        // CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), 
        CpiContext::new_with_signer(cpi_program, cpi_accounts, &[&ctx.accounts.vault.seeds()]), 
        shares
    )?;
    // Update balances

    let mut vault = &mut ctx.accounts.vault;
    
    vault.handle_deposit(amount, shares);

    Ok(())
}
