use anchor_lang::prelude::*;
use anchor_spl::{
    token::{ Mint, Token, TokenAccount},
    token_interface::Mint as InterfaceMint,
};
use std::mem::size_of;
use crate::constants::*;

use crate::state::*;

use super::deposit;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, 
        seeds = [STRATEGY_SEED.as_bytes()], 
        bump,  
        payer = admin, 
        space = size_of::<SimpleStrategy>() + 8,
    )]
    pub strategy: Account<'info, SimpleStrategy>,
    #[account(
        init, 
        seeds = [UNDERLYING_SEED.as_bytes()], 
        bump, 
        payer = admin, 
        token::mint = underlying_mint, 
        token::authority = strategy,
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

pub fn handler(ctx: Context<Initialize>, vault: Pubkey, depositLimit: u64) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    // Ok(())
    strategy.init(
        ctx.bumps.strategy,
        vault,
        ctx.accounts.admin.key(),
        depositLimit,
        ctx.accounts.underlying_mint.as_ref(),
        ctx.accounts.token_account.key(),
    )
}
