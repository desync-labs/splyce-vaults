use anchor_lang::prelude::*;
use anchor_spl::{
    token::{ Mint, Token, TokenAccount},
    token_interface::Mint as InterfaceMint,
};
use std::mem::size_of;
use crate::constants::*;

use crate::state::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    // TODO: need to think about proper seeds
    #[account(
        init, 
        seeds = [VAULT_SEED.as_bytes(), underlying_mint.key().as_ref()], 
        bump,  
        payer = admin, 
        space = size_of::<Vault>() + 8,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init, 
        seeds = [SHARES_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = admin, 
        mint::decimals = 18, 
        mint::authority = vault,
    )]
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        init, 
        seeds = [UNDERLYING_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = admin, 
        token::mint = underlying_mint,
        token::authority = vault,
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub underlying_mint: Box<InterfaceAccount<'info, InterfaceMint>>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_initialize(ctx: Context<Initialize>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.init(
        ctx.bumps.vault,
        ctx.accounts.underlying_mint.as_ref(),
        ctx.accounts.token_account.key(),
        1000000,
        0
    )
}
