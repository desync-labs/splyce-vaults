use anchor_lang::prelude::*;

use anchor_spl::{
    token::{ Token, TokenAccount},
    token_interface::Mint as InterfaceMint,
};

use crate::state::FaucetData;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, 
        seeds = ["data".as_bytes()], 
        bump, 
        payer = signer, 
        space= 8 + FaucetData::INIT_SPACE
    )]
    pub faucet_data: Box<Account<'info, FaucetData>>,

    #[account(
        init, 
        seeds = ["underlying".as_bytes()], 
        bump, 
        payer = signer, 
        token::mint = underlying_mint, 
        token::authority = token_account,
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,

    #[account()]
    pub underlying_mint: Box<InterfaceAccount<'info, InterfaceMint>>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn init(ctx: Context<Initialize>) -> Result<()> {
    let data = &mut ctx.accounts.faucet_data;

    data.owner = *ctx.accounts.signer.key;
    data.decimals = ctx.accounts.underlying_mint.decimals;
    data.amount = 100 * 10u64.pow(data.decimals as u32);

    Ok(())
}
