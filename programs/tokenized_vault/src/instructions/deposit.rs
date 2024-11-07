use access_control::{
    constants::USER_ROLE_SEED,
    program::AccessControl,
    state::{Role, UserRole},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{SHARES_SEED, UNDERLYING_SEED};

use crate::errors::ErrorCode;
use crate::events::VaultDepositEvent;
use crate::state::Vault;
use crate::utils::token;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [SHARES_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub shares_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_shares_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub access_control: Program<'info, AccessControl>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    validate_deposit(&ctx, amount)?;

    let shares = ctx.accounts.vault.load()?.convert_to_shares(amount);

    token::transfer_token_to(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.user_token_account.to_account_info(),
        ctx.accounts.vault_token_account.to_account_info(),
        ctx.accounts.user.to_account_info(),
        amount,
    )?;

    token::mint_to(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.shares_mint.to_account_info(),
        ctx.accounts.user_shares_account.to_account_info(),
        ctx.accounts.shares_mint.to_account_info(),
        shares,
        &ctx.accounts.vault.load()?.seeds_shares(),
    )?;

    let mut vault = ctx.accounts.vault.load_mut()?;
    vault.handle_deposit(amount, shares);

    emit!(VaultDepositEvent {
        vault_key: vault.key,
        total_debt: vault.total_debt,
        total_idle: vault.total_idle,
        total_share: vault.total_shares(),
        amount,
        share: shares,
        token_account: ctx.accounts.user_token_account.to_account_info().key(),
        share_account: ctx.accounts.user_shares_account.to_account_info().key(),
        token_mint: ctx.accounts.vault_token_account.mint,
        share_mint: ctx.accounts.shares_mint.to_account_info().key(),
        authority: ctx.accounts.user.to_account_info().key(),
    });

    Ok(())
}

fn validate_deposit(ctx: &Context<Deposit>, amount: u64) -> Result<()> {
    if amount == 0 {
        return Err(ErrorCode::ZeroValue.into());
    }

    let vault = ctx.accounts.vault.load()?;

    if vault.is_shutdown {
        return Err(ErrorCode::VaultShutdown.into());
    }

    if amount < vault.min_user_deposit {
        return Err(ErrorCode::MinDepositNotReached.into());
    }

    // todo: introduce deposit limit module
    if amount > vault.max_deposit() {
        return Err(ErrorCode::ExceedDepositLimit.into());
    }

    if vault.kyc_verified_only {
        let expected_roles_key = Pubkey::find_program_address(
            &[
                USER_ROLE_SEED.as_bytes(),
                ctx.accounts.user.key().as_ref(),
                Role::KYCVerified.to_seed().as_ref(),
            ],
            ctx.accounts.access_control.key,
        )
        .0;

        let roles_acc_info: Option<&AccountInfo> = ctx
            .remaining_accounts
            .iter()
            .find(|account| account.key.eq(&expected_roles_key));
        if roles_acc_info.is_none() {
            return Err(ErrorCode::KYCRequired.into());
        }

        let roles_data = roles_acc_info.unwrap().try_borrow_data()?;
        if roles_data.len() < UserRole::INIT_SPACE + 8 {
            return Err(ErrorCode::InvalidAccountType.into());
        }
        let roles = UserRole::try_from_slice(&roles_data[8..])
            .map_err(|_| ErrorCode::InvalidAccountType)?;

        if !roles.has_role {
            return Err(ErrorCode::KYCRequired.into());
        }
    }

    Ok(())
}
