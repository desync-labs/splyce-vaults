use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;
 
use strategy::utils::deserialize;
use strategy::cpi::accounts::{
    Deposit,
    Withdraw
};

pub fn deposit<'a>(
    strategy: AccountInfo<'a>,
    vault: AccountInfo<'a>,
    underlying_token_account: AccountInfo<'a>,
    vault_token_account: AccountInfo<'a>,
    token_program: AccountInfo<'a>,
    strategy_program: AccountInfo<'a>,
    assets_to_deposit: u64,
    seeds: &[&[u8]],
) -> Result<()> {
    // Perform the CPI deposit with pre-extracted data
    strategy::cpi::deposit(
        CpiContext::new_with_signer(
            strategy_program,
            Deposit {
                strategy,
                signer: vault,
                underlying_token_account,
                vault_token_account,
                token_program,
            },
            &[&seeds],  // Pass in the seeds from the previously loaded vault
        ),
        assets_to_deposit,
    )
}

pub fn withdraw<'a>(
    strategy: AccountInfo<'a>,
    vault: AccountInfo<'a>,
    underlying_token_account: AccountInfo<'a>,
    vault_token_account: &mut InterfaceAccount<'a, TokenAccount>,
    token_program: AccountInfo<'a>,
    strategy_program: AccountInfo<'a>,
    assets_to_withdraw: u64,
    seeds: &[&[&[u8]]],
    remaining_accounts: Vec<AccountInfo<'a>>,
) -> Result<u64> {
    let pre_balance = vault_token_account.amount;

    let mut context = CpiContext::new_with_signer(
        strategy_program, 
        Withdraw {
            strategy,
            underlying_token_account,
            signer: vault,
            vault_token_account: vault_token_account.to_account_info(),
            token_program,
        },
        seeds,
    );
    
    context.remaining_accounts = remaining_accounts;

    strategy::cpi::withdraw(context, assets_to_withdraw)?;

    vault_token_account.reload()?;
    let post_balance = vault_token_account.amount;

    Ok(post_balance - pre_balance)
}

pub fn get_vault(strategy_acc: &AccountInfo) -> Result<Pubkey> {
    let strategy = deserialize(strategy_acc)?;
    Ok(strategy.vault())
}

pub fn get_max_withdraw(strategy_acc: &AccountInfo) -> Result<u64> {
    let strategy = deserialize(strategy_acc)?;
    Ok(strategy.available_withdraw())
}

pub fn get_max_deposit(strategy_acc: &AccountInfo) -> Result<u64> {
    let strategy = deserialize(strategy_acc)?;
    Ok(strategy.available_deposit())
}

pub fn get_total_assets(strategy_acc: &AccountInfo) -> Result<u64> {
    let strategy = deserialize(strategy_acc)?;
    Ok(strategy.total_assets())
}

pub fn get_token_account_key(strategy_acc: &AccountInfo) -> Result<Pubkey> {
    let strategy = deserialize(strategy_acc)?;
    Ok(strategy.token_account())
}

pub fn assess_share_of_unrealised_losses(
    strategy_acc: &AccountInfo,
    assets_needed: u64,
    strategy_current_debt: u64,
) -> Result<u64> {
    let strategy_assets = get_total_assets(strategy_acc)?;
    if strategy_assets >= strategy_current_debt || strategy_current_debt == 0 {
        return Ok(0);
    }

    let numerator = assets_needed * strategy_assets;
    let losses_user_share = assets_needed - numerator / strategy_current_debt;

    Ok(losses_user_share)
}