use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{Mint, TokenAccount},
};

use crate::constants::CONFIG_SEED;
use crate::state::Config;
use crate::utils::serialization;

#[derive(Accounts)]
pub struct Distribute<'info> {
    /// CHECK: can be any accountant
    #[account(mut)]
    pub accountant: UncheckedAccount<'info>,

    #[account(mut)]
    pub recipient: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump)]
    pub config: Account<'info, Config>,

    /// CHECK:
    #[account(mut, address = config.admin)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = underlying_mint, 
        associated_token::authority = accountant,
    )]
    pub token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handle_distribute(ctx: Context<Distribute>) -> Result<()> {
    let mut accountant = serialization::from_unchecked(&ctx.accounts.accountant)?;
    accountant.distribute(&ctx.accounts)?;
    accountant.save_changes(&mut &mut ctx.accounts.accountant.try_borrow_mut_data()?[8..])
}