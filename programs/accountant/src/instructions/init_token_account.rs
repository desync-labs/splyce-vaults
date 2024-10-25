use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{Mint, TokenAccount},
};

use crate::state::*;
use crate::constants::CONFIG_SEED;

#[derive(Accounts)]
pub struct InitTokenAccount<'info> {
    #[account(
        init, 
        payer = signer, 
        associated_token::mint = underlying_mint, 
        associated_token::authority = accountant,
    )]
    pub token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: We want to hadle all accountant types here
    #[account(mut)]
    pub accountant: UncheckedAccount<'info>,
        
    #[account(mut)]
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump)]
    pub config: Account<'info, Config>,

    /// CHECK: This should be a vault account
    #[account(mut, address = config.admin)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_token_acc(_ctx: Context<InitTokenAccount>) -> Result<()> {
   Ok(())
}