// use anchor_lang::prelude::*;
// use anchor_spl::{
//     associated_token::AssociatedToken,
//     token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
// };

// use crate::state::*;

// #[derive(Accounts)]
// pub struct InitStrategy<'info> {
//     #[account(mut)]
//     pub vault: Account<'info, Vault>,
//     #[account(mut)]
//     pub user: Signer<'info>,
//     #[account(mut)]
//     pub user_token_account: Account<'info, TokenAccount>,
//     #[account(
//         init, 
//         seeds = [b"underlying"], 
//         bump, 
//         payer = admin, 
//         token::mint = underlying_mint,
//         token::authority = token_account,
//     )]
//     pub underlying_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub underlying_mint: Account<'info, Mint>,
//     #[account(mut)]
//     pub user_shares_account: Account<'info, TokenAccount>,
//     pub token_program: Program<'info, Token>,
// }
