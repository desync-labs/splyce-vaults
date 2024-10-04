use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount};

use crate::state::FaucetData;
use crate::error::ErrorCode;


#[derive(Accounts)]
pub struct SendTokens<'info> {
    #[account(seeds = ["data".as_bytes()], bump)]
    pub faucet_data: Account<'info, FaucetData>,

    #[account(mut, seeds = ["underlying".as_bytes()], bump)]
    pub token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub recipient: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn send_tokens(ctx: Context<SendTokens>)-> Result<()> {
    let seeds = &["underlying".as_bytes(), &[ctx.bumps.token_account]];
    let signer = [&seeds[..]];

    let data = &ctx.accounts.faucet_data;

    if data.amount == 0 {
        return Err(ErrorCode::FaucetStopped.into());
    }

    let balance = ctx.accounts.token_account.amount;
    if balance < data.amount {
        return Err(ErrorCode::EmptyFaucet.into());
    }

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
            },
            &signer
        ),
        data.amount
    )
}
