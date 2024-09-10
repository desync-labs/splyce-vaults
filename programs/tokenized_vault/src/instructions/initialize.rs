use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

use anchor_spl::{
    token::{ Mint, Token, TokenAccount},
    token_interface::Mint as InterfaceMint,
};
use crate::constants::*;

use crate::state::*;

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct Initialize<'info> {
    // TODO: need to think about proper seeds
    #[account(
        init, 
        seeds = [
            VAULT_SEED.as_bytes(), 
            underlying_mint.key().as_ref(),
            index.to_le_bytes().as_ref()
        ], 
        bump,  
        payer = admin, 
        space = Vault::LEN,
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
    #[account(mut, seeds = [ROLES_SEED.as_bytes()], bump)]
    pub roles_data: Account<'info, Roles>,
    #[account(
        mut, 
        address = roles_data.protocol_admin
    )]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_initialize(ctx: Context<Initialize>, index: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    // TODO: pass config params
    vault.init(
        ctx.bumps.vault,
        ctx.accounts.underlying_mint.as_ref(),
        ctx.accounts.token_account.key(),
        1_000_000,
        0,
        1000,
        index
    )
}
