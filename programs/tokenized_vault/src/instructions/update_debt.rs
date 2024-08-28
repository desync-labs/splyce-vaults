use core::str;

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use strategy_program::cpi::accounts::{
    Deposit as DepositAccounts,
    Withdraw as WithdrawAccounts
};
use strategy_program::program::StrategyProgram;
use strategy_program::{self};

use crate::state::*;
use crate::error::ErrorCode;
use crate::utils::strategy::*;
use crate::utils::token::*;

#[derive(Accounts)]
pub struct UpdateStrategyDebt<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    /// CHECK: Should this be mut?
    #[account(mut, constraint = vault.is_vault_strategy(strategy.key()))]
    pub strategy: AccountInfo<'info>,
    #[account(mut)]
    pub strategy_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub strategy_program: Program<'info, StrategyProgram>
}

pub fn handle_update_debt(
    ctx: Context<UpdateStrategyDebt>, 
    mut new_debt: u64,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let strategy = &ctx.accounts.strategy;
    let strategy_data = vault.get_strategy_data(strategy.key())?;
    let vault_idle =  vault.total_idle;
    let current_debt = strategy_data.current_debt;

    if vault.is_shutdown {
        new_debt = 0;
    }

    if new_debt == current_debt {
        return Err(ErrorCode::SameDebt.into());
    }

    if new_debt < current_debt     {
        let mut assets_to_withdraw = current_debt - new_debt;

        if vault_idle + assets_to_withdraw < vault.minimum_total_idle {
            assets_to_withdraw = vault.minimum_total_idle - vault_idle;
            if assets_to_withdraw > current_debt {
                assets_to_withdraw = current_debt;
            }
        }

        let withdrawable = get_max_withdraw(&strategy)?;
        if withdrawable == 0 {
            return Err(ErrorCode::CannotWithdraw.into());
        }

        if assets_to_withdraw > withdrawable {
            assets_to_withdraw = withdrawable;
        }

        if current_debt > get_total_assets(&strategy)? {
            return Err(ErrorCode::UnrealisedLosses.into());
        }

        let pre_balance = ctx.accounts.vault_token_account.amount;
        strategy_program::cpi::withdraw_funds(
            CpiContext::new(
            ctx.accounts.strategy_program.to_account_info(), WithdrawAccounts {
                strategy: ctx.accounts.strategy.to_account_info(),
                token_account: ctx.accounts.strategy_token_account.to_account_info(),
                vault_token_account: ctx.accounts.vault_token_account.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            }), 
            assets_to_withdraw
        )?;
        let post_balance = ctx.accounts.vault_token_account.amount;

        let withdrawn = post_balance - pre_balance;

        if withdrawn > assets_to_withdraw {
            assets_to_withdraw = withdrawn;
        }

        vault.total_idle += withdrawn;
        vault.total_debt -= assets_to_withdraw;
        new_debt = current_debt - assets_to_withdraw;
    } else if new_debt > strategy_data.current_debt {
        if new_debt > strategy_data.max_debt {
            return Err(ErrorCode::DebtHigherThanMaxDebt.into());
        }

        let max_deposit = get_max_deposit(&strategy)?;
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

        strategy_program::cpi::deposit_funds(
            CpiContext::new_with_signer(
                ctx.accounts.strategy_program.to_account_info(),
                DepositAccounts {
                    strategy: ctx.accounts.strategy.to_account_info(),
                    vault: vault.to_account_info(),
                    token_account: ctx.accounts.strategy_token_account.to_account_info(),
                    vault_token_account: ctx.accounts.vault_token_account.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                &[&vault.seeds()],
            ),
            assets_to_deposit,
        )?;

        vault.total_idle -= assets_to_deposit;
        vault.total_debt += assets_to_deposit;
        new_debt = current_debt + assets_to_deposit;
    }
    vault.set_current_debt(strategy.key(), new_debt)?;
    
    Ok(())
}

pub fn get_token_balance<'a>(
    token_program: AccountInfo<'a>,
    account: AccountInfo<'a>,
) -> Result<u64> {
    let account_data = account.try_borrow_data()?;
    let token_account = TokenAccount::try_deserialize(&mut &account_data[..])?;
    Ok(token_account.amount)
}