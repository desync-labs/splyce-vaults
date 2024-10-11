use anchor_lang::prelude::*;

use anchor_spl::{
    token::Token,
    token_interface::{Mint, TokenAccount},
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3, 
        Metadata,
    }
};

use crate::events::VaultInitEvent;
use crate::constants::{
    VAULT_SEED, 
    SHARES_SEED, 
    SHARES_ACCOUNT_SEED, 
    ROLES_SEED,
};
use crate::state::*;

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct InitVaultShares<'info> {
    #[account(mut, seeds = [VAULT_SEED.as_bytes(), index.to_le_bytes().as_ref()], bump)]
    pub vault: AccountLoader<'info, Vault>,
    
    #[account(
        init, 
        seeds = [SHARES_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = signer, 
        mint::decimals = 9, 
        mint::authority = shares_mint,
    )]
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: We initialize this metadata account via the Metaplex Metadata Program, so we don't have to check it here
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init, 
        seeds = [SHARES_ACCOUNT_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = signer, 
        token::mint = shares_mint,
        token::authority = vault,
    )]
    pub shares_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    
    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Box<Account<'info, AccountRoles>>,
    
    #[account(mut, constraint = roles.is_vaults_admin)]
    pub signer: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_init_vault_shares(ctx: Context<InitVaultShares>, _index: u64, config: Box<SharesConfig>) -> Result<()> {
    let vault_key = ctx.accounts.vault.key();
    let seeds = &[SHARES_SEED.as_bytes(), vault_key.as_ref(), &[ctx.bumps.shares_mint]];
    let signer = [&seeds[..]];

    let token_data: DataV2 = DataV2 {
        name: config.name,
        symbol: config.symbol,
        uri: config.uri,
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };

    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.signer.to_account_info(),
                update_authority: ctx.accounts.shares_mint.to_account_info(),
                mint: ctx.accounts.shares_mint.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                mint_authority: ctx.accounts.shares_mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &signer
        ),
        token_data,
        false,
        true,
        None,
    )?;

    let vault = &mut ctx.accounts.vault.load_mut()?;
    vault.shares_bump = [ctx.bumps.shares_mint];

    emit!(VaultInitEvent {
        vault_index: vault.index_buffer,
        underlying_mint: vault.underlying_mint,
        underlying_token_acc: vault.underlying_token_acc,
        underlying_decimals: vault.underlying_decimals,
        share_mint: ctx.accounts.shares_mint.key(),
        share_token_acc: ctx.accounts.shares_token_account.key(),
        share_decimals: ctx.accounts.shares_mint.decimals,
        deposit_limit: vault.deposit_limit,
        min_user_deposit: vault.min_user_deposit,
        performance_fee: vault.performance_fee,
        vault_pda: vault_key,
    });

    Ok(())
}


