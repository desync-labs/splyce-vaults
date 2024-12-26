use anchor_lang::prelude::*;
use access_control::{
    constants::USER_ROLE_SEED,
    program::AccessControl,
    state::{UserRole, Role}
};
use anchor_spl::{
    associated_token::{AssociatedToken, get_associated_token_address},
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3, 
        Metadata,
    },
    token::Token,
    token_interface::{Mint, TokenAccount, TokenInterface}
};

use crate::constants::{CONFIG_SEED, SHARES_SEED, VAULT_SEED};
use crate::events::{TokenData, TokenMetaData,  VaultInitEvent};
use crate::state::{Config, SharesConfig, Vault, VaultConfig};

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(
        init, 
        seeds = [
            VAULT_SEED.as_bytes(), 
            config.next_vault_index.to_le_bytes().as_ref()
        ], 
        bump,  
        payer = signer, 
        space = Vault::LEN,
    )]
    pub vault: AccountLoader<'info, Vault>,
    
    #[account(
        init, 
        payer = signer, 
        associated_token::mint = underlying_mint, 
        associated_token::authority = vault,
    )]
    pub underlying_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init, 
        seeds = [SHARES_SEED.as_bytes(), vault.key().as_ref()], 
        bump, 
        payer = signer, 
        mint::decimals = 9, 
        mint::authority = shares_mint,
        mint::token_program = shares_token_program,
    )]
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,
    
    /// CHECK: We initialize this metadata account via the Metaplex Metadata Program, so we don't have to check it here
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account()]
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,
    
    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump)]
    pub config: Box<Account<'info, Config>>,

    #[account(
        seeds = [
            USER_ROLE_SEED.as_bytes(), 
            signer.key().as_ref(),
            Role::VaultsAdmin.to_seed().as_ref()
        ], 
        bump,
        seeds::program = access_control.key()
    )]
    pub roles: Box<Account<'info, UserRole>>,

    #[account(mut, constraint = roles.check_role()?)]
    pub signer: Signer<'info>,
    
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub access_control: Program<'info, AccessControl>,
    pub metadata_program: Program<'info, Metadata>,
    pub token_program: Interface<'info, TokenInterface>,
    pub shares_token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_init_vault(ctx: Context<InitVault>, config: Box<VaultConfig>, shares_config: Box<SharesConfig>) -> Result<()> {
    ctx.accounts.vault.load_init()?.init(
        ctx.accounts.config.next_vault_index,
        ctx.bumps.vault,
        ctx.bumps.shares_mint,
        ctx.accounts.vault.key(),
        ctx.accounts.underlying_mint.as_ref(),
        ctx.accounts.underlying_token_account.key(),
        config.as_ref()
    )?;

    ctx.accounts.config.next_vault_index += 1;

    let token_data: DataV2 = DataV2 {
        name: shares_config.name.clone(),
        symbol: shares_config.symbol.clone(),
        uri: shares_config.uri,
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };

    let vault_key = ctx.accounts.vault.key();
    let seeds = &[SHARES_SEED.as_bytes(), vault_key.as_ref(), &[ctx.bumps.shares_mint]];
    let signer = [&seeds[..]];

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

    let underlying_token = TokenData{
        mint: ctx.accounts.underlying_mint.key(),
        account: ctx.accounts.underlying_token_account.key(),
        decimals: ctx.accounts.underlying_mint.decimals,
        metadata: TokenMetaData {
            name: "".to_string(),
            symbol: "".to_string()
        }
    };

    let share_token = TokenData{
        mint: ctx.accounts.shares_mint.key(),
        account: get_associated_token_address(&ctx.accounts.vault.key(), &ctx.accounts.shares_mint.key()),
        decimals: ctx.accounts.shares_mint.decimals,
        metadata: TokenMetaData {
            name: shares_config.name,
            symbol: shares_config.symbol,
        }
    };

    emit!(VaultInitEvent {
        vault_key: ctx.accounts.vault.key(),
        underlying_token,
        share_token,
        deposit_limit: config.deposit_limit,
        min_user_deposit: config.min_user_deposit,
        accountant: config.accountant,
        profit_max_unlock_time: config.profit_max_unlock_time,
        kyc_verified_only: config.kyc_verified_only,
        direct_deposit_enabled: config.direct_deposit_enabled,
        whitelisted_only: config.whitelisted_only,
    });

    Ok(())
}


