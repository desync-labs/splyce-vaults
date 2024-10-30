use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};
use strategy_program::program::StrategyProgram;

use crate::events::VaultWithdrawlEvent;
use crate::{state::*, utils::strategy};
use crate::error::ErrorCode;
use crate::constants::{
    UNDERLYING_SEED, 
    SHARES_SEED,
    MAX_BPS
};

#[derive(Accounts)]
pub struct Withdraw<'info> {
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
    pub strategy_program: Program<'info, StrategyProgram>,
}

#[derive(Default, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AccountsIndexes {
    pub strategy_acc: u64,
    pub strategy_token_account: u64,
    pub remaining_accounts_to_strategies: Vec<u64>,
}

#[derive(Default, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AccountsMap {
    pub accounts_map: Vec<AccountsIndexes>,
}

pub fn handle_withdraw<'info>(
    ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
    assets: u64,
    shares_to_burn: u64,
    max_loss: u64,
    remaining_accounts_map: AccountsMap
) -> Result<()> {
    if assets == 0 || shares_to_burn == 0 {
        return Err(ErrorCode::ZeroValue.into());
    }
    let vault_token_account = &mut ctx.accounts.vault_token_account;
    let user_shares_balance = ctx.accounts.user_shares_account.amount;
    let remaining_accounts = ctx.remaining_accounts;
    let (
        strategies, 
        strategy_token_accounts, 
        strategy_remaining_accounts
    ) = get_strategies_with_token_acc(
        remaining_accounts, 
        remaining_accounts_map
    )?;
    if user_shares_balance < shares_to_burn {
        return Err(ErrorCode::InsufficientShares.into());
    }

    let max_withdraw = ctx.accounts.vault.load()?.max_withdraw(user_shares_balance, &strategies, max_loss)?;
    if assets > max_withdraw {
        return Err(ErrorCode::ExceedWithdrawLimit.into());
    }

    // todo: hadle min user deposit

    let assets_to_transfer = withdraw_assets(
        vault_token_account,
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.strategy_program.to_account_info(),
        &ctx.accounts.vault,
        assets,
        strategies,
        strategy_token_accounts,
        strategy_remaining_accounts,
    )?;

    if assets > assets_to_transfer && max_loss < MAX_BPS {
        if assets - assets_to_transfer > (assets * max_loss) / MAX_BPS {
            return Err(ErrorCode::TooMuchLoss.into());
        }
    }

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(), 
            Burn {
                mint: ctx.accounts.shares_mint.to_account_info(),
                from: ctx.accounts.user_shares_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            }
        ), 
        shares_to_burn
    )?;

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            }, 
            &[&ctx.accounts.vault.load()?.seeds()]
        ), 
        assets_to_transfer
    )?;

    let mut vault = ctx.accounts.vault.load_mut()?;
    vault.handle_withdraw(assets_to_transfer, shares_to_burn);

    emit!(VaultWithdrawlEvent {
        vault_key: vault.key,
        total_idle: vault.total_idle,
        total_share: vault.total_shares,
        assets_to_transfer,
        shares_to_burn,
        token_account: ctx.accounts.user_token_account.to_account_info().key(),
        share_account: ctx.accounts.user_shares_account.to_account_info().key(),
        token_mint: ctx.accounts.vault_token_account.mint,
        share_mint: ctx.accounts.shares_mint.to_account_info().key(),
        authority: ctx.accounts.user.to_account_info().key(),
    });

    Ok(())
}

fn get_strategies_with_token_acc<'info>(
    remaining_accounts: &[AccountInfo<'info>],
    remaining_accounts_map: AccountsMap
) -> Result<(Vec<AccountInfo<'info>>, Vec<AccountInfo<'info>>, Vec<Vec<AccountInfo<'info>>>)> {
    // Ensure there are an even number of remaining accounts
    if remaining_accounts.len() % 2 != 0 {
        return Err(ErrorCode::InvalidAccountPairs.into());
    }

    let accounts_map = &remaining_accounts_map.accounts_map;

    let mut strategy_account_infos: Vec<AccountInfo<'info>> = Vec::new();
    let mut token_accounts: Vec<AccountInfo<'info>> = Vec::new();
    let mut strategy_remaining_accounts: Vec<Vec<AccountInfo<'info>>> = Vec::new();

    for i in 0..accounts_map.len() {
        let strategy_acc_info: &AccountInfo<'info> = &remaining_accounts[accounts_map[i].strategy_acc as usize];
        let token_account_info: &AccountInfo<'info> = &remaining_accounts[accounts_map[i].strategy_token_account as usize];
        let expected_token_account = strategy::get_token_account_key(&strategy_acc_info)?;

        if token_account_info.key() != expected_token_account {
            return Err(ErrorCode::InvalidAccountPairs.into());
        }

        strategy_account_infos.push(strategy_acc_info.clone());
        token_accounts.push(token_account_info.clone());

        if !accounts_map[i].remaining_accounts_to_strategies.is_empty() {
            for j in 0..accounts_map[i].remaining_accounts_to_strategies.len() {
                let acc: &AccountInfo<'info> = &remaining_accounts[accounts_map[i].remaining_accounts_to_strategies[j] as usize];
                strategy_remaining_accounts.push(vec![acc.clone()]);
            }
        }
    }

    Ok((strategy_account_infos, token_accounts, strategy_remaining_accounts))
}

fn withdraw_assets<'info>(
    vault_token_account: &mut Account<'info, TokenAccount>,
    token_program: &AccountInfo<'info>,
    strategy_program: &AccountInfo<'info>,
    vault_acc: &AccountLoader<'info, Vault>,
    assets: u64,
    strategies: Vec<AccountInfo<'info>>,
    token_accounts: Vec<AccountInfo<'info>>,
    remaining_accounts: Vec<Vec<AccountInfo<'info>>>
) -> Result<u64> {
    let vault = vault_acc.load()?.clone();
    let mut requested_assets = assets;
    let mut total_idle = vault.total_idle;
    let mut total_debt = vault.total_debt;

    if requested_assets > total_idle {
        let mut assets_needed = requested_assets - total_idle;

        for i in 0..strategies.len() {
            let strategy_acc = &strategies[i];
            let strategy_data = vault.get_strategy_data(strategy_acc.key())?.clone();
            let mut current_debt = strategy_data.current_debt;
            if !strategy_data.is_active {
                return Err(ErrorCode::InactiveStrategy.into());
            }

            let mut to_withdraw = std::cmp::min(assets_needed as u64, current_debt);
            let strategy_limit = strategy::get_max_withdraw(&strategy_acc)?;
            let mut unrealised_loss_share = strategy::assess_share_of_unrealised_losses(
                &strategy_acc,
                to_withdraw, 
                current_debt
            )?;

            if unrealised_loss_share > 0 {
                if strategy_limit < to_withdraw - unrealised_loss_share {
                    let wanted = to_withdraw - unrealised_loss_share;
                    unrealised_loss_share = (unrealised_loss_share * strategy_limit) / wanted;
                    to_withdraw = strategy_limit;
                } else {
                    to_withdraw -= unrealised_loss_share;
                }

                requested_assets -= unrealised_loss_share;
                assets_needed -= unrealised_loss_share;
                total_debt -= unrealised_loss_share;

                if strategy_limit == 0 && unrealised_loss_share > 0 {
                    current_debt = current_debt - unrealised_loss_share;
                }
            }

            to_withdraw = std::cmp::min(to_withdraw, strategy_limit);

            if to_withdraw == 0 {
                continue;
            }

            let withdrawn = strategy::withdraw(
                strategy_acc.to_account_info(),
                vault_acc.to_account_info(),
                token_accounts[i].to_account_info(),
                vault_token_account,
                token_program.to_account_info(),
                strategy_program.to_account_info(),
                to_withdraw,
                &[&vault.seeds()],
                remaining_accounts[i].clone()
            )?;

            let mut loss = 0;

            if withdrawn > to_withdraw {
                if withdrawn > current_debt {
                    to_withdraw = current_debt;
                } else {
                    to_withdraw = withdrawn;
                }
            } else if withdrawn < to_withdraw {
                loss = to_withdraw - withdrawn;
            }

            total_idle += to_withdraw - loss;
            requested_assets -= loss;
            total_debt -= to_withdraw;

            let new_debt: u64 = current_debt - (to_withdraw + unrealised_loss_share);

            let vault_mut = &mut vault_acc.load_mut()?;
            let strategy_data_mut = vault_mut.get_strategy_data_mut(strategy_acc.key())?;
            strategy_data_mut.current_debt = new_debt;
            vault_mut.total_debt = total_debt;
            vault_mut.total_idle = total_idle;

            if requested_assets <= total_idle {
                break;
            }

            assets_needed -= to_withdraw;
        }

        if total_idle < requested_assets {
            return Err(ErrorCode::InsufficientFunds.into());
        }
    }

    Ok(requested_assets)
}
