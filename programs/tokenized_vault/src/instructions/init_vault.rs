use anchor_lang::prelude::*;

use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use crate::constants::{
    VAULT_SEED, 
    SHARES_SEED, 
    SHARES_ACCOUNT_SEED, 
    UNDERLYING_SEED, 
    ROLES_SEED,
    DISCRIMINATOR_LEN,
};
use crate::state::*;

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct Initialize<'info> {
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
        seeds = [SHARES_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = signer, 
        mint::decimals = 9, 
        mint::authority = vault,
    )]
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,
    
    #[account(
        init, 
        seeds = [UNDERLYING_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = signer, 
        token::mint = underlying_mint,
        token::authority = vault,
    )]
    pub token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    
    #[account(
        init, 
        seeds = [SHARES_ACCOUNT_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = signer, 
        token::mint = shares_mint,
        token::authority = vault,
    )]
    pub shares_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    
    #[account(mut)]
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,
    
    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Account<'info, AccountRoles>,
    
    #[account(mut, constraint = roles.is_vaults_admin)]
    pub signer: Signer<'info>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Clone, Debug)]
pub struct VaultConfig {
    pub deposit_limit: u64,
    pub min_user_deposit: u64,
    pub performance_fee: u64,
    pub profit_max_unlock_time: u64,
}

pub fn handle_init_vault(ctx: Context<Initialize>, index: u64, config: VaultConfig) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_init()?;
    msg!("max deposit limit: {}", config.deposit_limit);
    vault.init(
        ctx.bumps.vault,
        ctx.accounts.underlying_mint.as_ref(),
        ctx.accounts.token_account.key(),
        ctx.accounts.shares_mint.as_ref(),
        ctx.accounts.shares_token_account.key(),
        config.deposit_limit,
        config.min_user_deposit,
        config.performance_fee,
        index,
        config.profit_max_unlock_time,
    )
}
