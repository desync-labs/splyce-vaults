use std::cell::Ref;

use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use strategy_program::program::StrategyProgram;

use crate::events::UpdatedCurrentDebtForStrategyEvent;
use crate::state::*;
use crate::error::ErrorCode;
use crate::utils::strategy;
use crate::constants::{ROLES_SEED, UNDERLYING_SEED};

#[derive(Accounts)]
#[instruction(new_debt: u64)]
pub struct UpdateStrategyDebt<'info> {
    #[account(
        mut,
        constraint = !vault.load()?.is_shutdown || new_debt == 0,
    )]
    pub vault: AccountLoader<'info, Vault>,

    #[account(mut, seeds = [UNDERLYING_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: Should this be mut?
    #[account(mut, constraint = vault.load()?.is_vault_strategy(strategy.key()))]
    pub strategy: AccountInfo<'info>,

    #[account(mut)]
    pub strategy_token_account: Account<'info, TokenAccount>,

    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Account<'info, AccountRoles>,

    #[account(mut, constraint = roles.is_vaults_admin)]
    pub signer: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub strategy_program: Program<'info, StrategyProgram>
}

pub fn handle_update_debt<'a, 'b, 'c, 'info>(
    mut ctx: Context<'a, 'b, 'c, 'info, UpdateStrategyDebt<'info>>, 
    new_debt: u64,
) -> Result<()> {
    let (total_idle, total_debt, new_debt) = handle_internal(&mut ctx, new_debt)?;

    let vaut_mut = &mut ctx.accounts.vault.load_mut()?;
    vaut_mut.total_idle = total_idle;
    vaut_mut.total_debt = total_debt;

    let strategy_data_mut = vaut_mut.get_strategy_data_mut(ctx.accounts.strategy.key())?;
    strategy_data_mut.current_debt = new_debt;

    emit!(UpdatedCurrentDebtForStrategyEvent {
        vault_index: vaut_mut.index_buffer,
        strategy_key: ctx.accounts.strategy.key(),
        total_idle: total_idle,
        total_debt: total_debt,
        new_debt,
    });

    Ok(())
}

fn handle_internal<'a, 'b, 'c, 'info>(
    ctx: &mut Context<'a, 'b, 'c, 'info, UpdateStrategyDebt<'info>>,
    mut new_debt: u64,
) -> Result<(u64, u64, u64)> {
    let vault = ctx.accounts.vault.load()?;
    let vault_seeds: &[&[u8]] = &vault.seeds();
    let current_debt = vault.get_strategy_data(ctx.accounts.strategy.key())?.current_debt;

    if new_debt == current_debt {
        return Err(ErrorCode::SameDebt.into());
    }

    if new_debt < current_debt {
        let mut assets_to_withdraw = get_assets_to_withdraw(
            &vault,
            ctx.accounts.strategy.to_account_info(),
            current_debt,
            new_debt
        )?;

        let remaining_accounts: Vec<AccountInfo> = ctx.remaining_accounts.to_vec();

        let withdrawn = strategy::withdraw(
            ctx.accounts.strategy.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.strategy_token_account.to_account_info(),
            &mut ctx.accounts.vault_token_account,
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.strategy_program.to_account_info(),
            assets_to_withdraw,
            &[&vault_seeds],
            remaining_accounts
        )?;
    
        if withdrawn > assets_to_withdraw {
            assets_to_withdraw = withdrawn;
        }

        new_debt = current_debt - assets_to_withdraw;

        return Ok((
            vault.total_idle + assets_to_withdraw, 
            vault.total_debt - assets_to_withdraw, 
            new_debt
        ));
    } else {
        let assets_to_deposit = get_assets_deposit(
            &vault,
            ctx.accounts.strategy.to_account_info(),
            current_debt,
            new_debt,
        )?;

        strategy::deposit(
            ctx.accounts.strategy.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.strategy_token_account.to_account_info(),
            ctx.accounts.vault_token_account.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.strategy_program.to_account_info(),
            assets_to_deposit,
            vault_seeds
        )?;

        new_debt = current_debt + assets_to_deposit;

        return Ok((
            vault.total_idle - assets_to_deposit, 
            vault.total_debt + assets_to_deposit, 
            new_debt
        ));
    }


}

fn get_assets_to_withdraw(
    vault: &Ref<Vault>,
    strategy_acc: AccountInfo,
    current_debt: u64,
    new_debt: u64,
) -> Result<u64> {
    let mut assets_to_withdraw = current_debt - new_debt;
    let vault_idle = vault.total_idle;

    if vault_idle + assets_to_withdraw < vault.minimum_total_idle {
        assets_to_withdraw = vault.minimum_total_idle - vault_idle;
        if assets_to_withdraw > current_debt {
            assets_to_withdraw = current_debt;
        }
    }

    let withdrawable = strategy::get_max_withdraw(&strategy_acc)?;
    if withdrawable == 0 {
        return Err(ErrorCode::CannotWithdraw.into());
    }

    if assets_to_withdraw > withdrawable {
        assets_to_withdraw = withdrawable;
    }

    if current_debt > strategy::get_total_assets(&strategy_acc)? {
        return Err(ErrorCode::UnrealisedLosses.into());
    }

    Ok(assets_to_withdraw)
}

fn get_assets_deposit<'info>(
    vault: &Ref<Vault>,
    strategy_acc: AccountInfo,
    current_debt: u64,
    new_debt: u64,
) -> Result<u64> { 
    if new_debt > vault.get_strategy_data(strategy_acc.key())?.max_debt {
        return Err(ErrorCode::DebtHigherThanMaxDebt.into());
    }

    let max_deposit = strategy::get_max_deposit(&strategy_acc)?;
    if max_deposit == 0 {
        return Err(ErrorCode::CannotDeposit.into());
    }

    let mut assets_to_deposit = new_debt - current_debt;
    if assets_to_deposit > max_deposit {
        assets_to_deposit = max_deposit;
    }

    if vault.total_idle <= vault.minimum_total_idle {
        return Err(ErrorCode::InsufficientFunds.into());
    }

    let available_idle = vault.total_idle - vault.minimum_total_idle;
    if assets_to_deposit > available_idle {
        assets_to_deposit = available_idle;
    }

    Ok(assets_to_deposit)
}