use anchor_lang::prelude::*;
use anchor_spl::{
    token::{ Token, TokenAccount},
    token_interface::Mint as InterfaceMint,
};
use crate::constants::*;
use crate::state::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, 
        seeds = [
            STRATEGY_SEED.as_bytes(), 
            vault.key().as_ref()
        ], 
        bump,  
        payer = admin, 
        space = SimpleStrategy::LEN,
    )]
    pub strategy: Box<Account<'info, SimpleStrategy>>,
    #[account(
        init, 
        seeds = [UNDERLYING_SEED.as_bytes()], 
        bump, 
        payer = admin, 
        token::mint = underlying_mint, 
        token::authority = strategy,
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: This should be a vault account
    #[account()]
    pub vault: AccountInfo<'info>,
    #[account(mut)]
    pub underlying_mint: Box<InterfaceAccount<'info, InterfaceMint>>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>, deposit_limit: u64) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    // Ok(())
    strategy.init(
        ctx.bumps.strategy,
        ctx.accounts.vault.key(),
        deposit_limit,
        ctx.accounts.underlying_mint.as_ref(),
        ctx.accounts.token_account.key(),
    )
}
