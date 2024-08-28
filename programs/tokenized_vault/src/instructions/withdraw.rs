use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Burn, Mint, Token, TokenAccount, Transfer},
};

use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub shares_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_shares_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

fn handle_internal<'info>(
    ctx: Context<Withdraw<'info>>,
    assets: u64,
    shares_to_burn: u64,
    max_loss: u64,
) -> Result<()> {
    if assets == 0 || shares_to_burn == 0 {
        return Err(ErrorCode::ZeroValue.into());
    }

    let vault = &ctx.accounts.vault;
    let user_shares_balance = ctx.accounts.user_shares_account.amount;

    let strategies = &ctx.remaining_accounts;
    for account_info in strategies.iter() {
        if !vault.is_vault_strategy(account_info.key()) {
            return Err(ErrorCode::IsNotVaultStrategy.into());
        }
    }

    if user_shares_balance < shares_to_burn {
        return Err(ErrorCode::InsufficientShares.into());
    }

    let max_withdraw = vault.max_withdraw(user_shares_balance, strategies, max_loss)?;
    if assets > max_withdraw {
        return Err(ErrorCode::ExceedWithdrawLimit.into());
    }

    // todo: hadle min user deposit



   
    /*
        uint256 maxWithdrawAmount = _maxWithdraw(owner, maxLoss, _strategies);
        if (assets > maxWithdrawAmount) {
            revert ExceedWithdrawLimit(maxWithdrawAmount);
        }

        uint256 minDepositAmount = minUserDeposit;
        uint256 depositedAssets = VaultLogic.convertToAssets(sharesBalanceOf[owner], _totalSupply(), _totalAssets(), Rounding.ROUND_DOWN);
        uint256 expectedLeftover = depositedAssets - assets;

        if (expectedLeftover > 0 && expectedLeftover < minDepositAmount) {
            revert MinDepositNotReached();
        }

        _handleAllowance(owner, sender, sharesToBurn);
        (uint256 requestedAssets, uint256 currTotalIdle) = _withdrawAssets(assets, _strategies);
        _finalizeRedeem(receiver, owner, sharesToBurn, assets, requestedAssets, currTotalIdle, maxLoss);

        emit Withdraw(sender, receiver, owner, requestedAssets, sharesToBurn);
        return requestedAssets;
     */
    Ok(())
}

pub fn handle_withdraw(ctx: Context<Withdraw>, amount: u64, max_loss: u64) -> Result<()> {
    let shares = ctx.accounts.vault.convert_to_shares(amount);
    handle_internal(ctx, amount, shares, max_loss)
}

pub fn handle_redeem(ctx: Context<Withdraw>, shares: u64, max_loss: u64) -> Result<()> {
    let amount = ctx.accounts.vault.convert_to_underlying(shares);
    handle_internal(ctx, amount, shares, max_loss)

    // Calculate amount to withdraw
    // let amount = ctx.accounts.vault.convert_to_underlying(shares);

    // // Burn shares from user
    // token::burn(
    //     CpiContext::new(
    //         ctx.accounts.token_program.to_account_info(), 
    //         Burn {
    //             mint: ctx.accounts.shares_mint.to_account_info(),
    //             from: ctx.accounts.user_shares_account.to_account_info(),
    //             authority: ctx.accounts.user.to_account_info(),
    //         }
    //     ), 
    //     shares)?;

    // // Transfer tokens from vault to user
    // token::transfer(
    //     CpiContext::new_with_signer(
    //         ctx.accounts.token_program.to_account_info(), 
    //         Transfer {
    //             from: ctx.accounts.vault_token_account.to_account_info(),
    //             to: ctx.accounts.user_token_account.to_account_info(),
    //             authority: ctx.accounts.vault.to_account_info(),
    //         }, 
    //         &[&ctx.accounts.vault.seeds()]
    //     ), 
    //     amount)?;

    // // Update balances
    // let vault = &mut ctx.accounts.vault;
    // vault.handle_withdraw(amount, shares);

    // Ok(())
}