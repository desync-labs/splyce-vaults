use anchor_lang::prelude::*;

use anchor_spl::{
    token::Token, 
    token_interface::{Mint, TokenAccount},
};

use crate::constants::{
    VAULT_SEED, 
    UNDERLYING_SEED, 
    ROLES_SEED,
    DISCRIMINATOR_LEN,
};
use crate::state::*;

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct InitVault<'info> {
    #[account(
        init, 
        seeds = [
            VAULT_SEED.as_bytes(), 
            index.to_le_bytes().as_ref()
        ], 
        bump,  
        payer = signer, 
        space = DISCRIMINATOR_LEN + Vault::INIT_SPACE,
    )]
    pub vault: AccountLoader<'info, Vault>,
    
    #[account(
        init, 
        seeds = [UNDERLYING_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = signer, 
        token::mint = underlying_mint,
        token::authority = vault,
    )]
    pub underlying_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    
    #[account(mut)]
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,
    
    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Box<Account<'info, AccountRoles>>,
    
    #[account(mut, constraint = roles.is_vaults_admin)]
    pub signer: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_init_vault(ctx: Context<InitVault>, index: u64, config: Box<VaultConfig>) -> Result<()> {
    ctx.accounts.vault.load_init()?.init(
        index,
        ctx.bumps.vault,
        ctx.accounts.vault.key(),
        ctx.accounts.underlying_mint.as_ref(),
        ctx.accounts.underlying_token_account.key(),
        config.as_ref()
    )?;

    Ok(())
}


