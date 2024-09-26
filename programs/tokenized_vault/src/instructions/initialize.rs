use anchor_lang::prelude::*;

use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use crate::constants::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct Initialize<'info> {
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
    pub vault: AccountLoader<'info, Vault>,
    
    #[account(
        init, 
        seeds = [SHARES_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = admin, 
        mint::decimals = 18, 
        mint::authority = vault,
    )]
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,
    
    #[account(
        init, 
        seeds = [UNDERLYING_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = admin, 
        token::mint = underlying_mint,
        token::authority = vault,
    )]
    pub token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    
    #[account(
        init, 
        seeds = [SHARES_ACCOUNT_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = admin, 
        token::mint = shares_mint,
        token::authority = vault,
    )]
    pub shares_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    
    #[account(mut)]
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,
    
    #[account(seeds = [ROLES_SEED.as_bytes()], bump)]
    pub roles: Account<'info, Roles>,
    
    #[account(mut, address = roles.protocol_admin)]
    pub admin: Signer<'info>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
pub fn handle_initialize(ctx: Context<Initialize>, index: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_init()?;
    // TODO: pass config params
    vault.init(
        ctx.bumps.vault,
        ctx.accounts.underlying_mint.as_ref(),
        ctx.accounts.token_account.key(),
        ctx.accounts.shares_mint.as_ref(),
        ctx.accounts.shares_token_account.key(),
        1_000_000,
        0,
        1000,
        index,
        0,
    )

    // Ok(())
}
