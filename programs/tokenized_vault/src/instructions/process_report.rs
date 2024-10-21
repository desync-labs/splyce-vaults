use anchor_lang::prelude::*;
use anchor_spl::{
    token::Token,
    token_interface::{self as token, Burn, Mint, MintTo, TokenAccount},
};

use crate::constants::{FEE_BPS, MAX_BPS_EXTENDED, ROLES_SEED, SHARES_ACCOUNT_SEED, SHARES_SEED};
use crate::events::StrategyReportedEvent;
use crate::state::*;
use crate::utils::strategy;

#[derive(Accounts)]
pub struct ProcessReport<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,

    /// CHECK: can by any strategy
    #[account()]
    pub strategy: UncheckedAccount<'info>,

    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Box<Account<'info, AccountRoles>>,

    #[account(mut, seeds = [SHARES_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut, seeds = [SHARES_ACCOUNT_SEED.as_bytes(), vault.key().as_ref()], bump)]
    pub vault_shares_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub fee_shares_recipient: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, constraint = roles.is_reporting_manager)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_process_report(ctx: Context<ProcessReport>) -> Result<()> {
    let strategy_assets = strategy::get_total_assets(&ctx.accounts.strategy)?;
    let strategy = &ctx.accounts.strategy;

    let mut gain: u64 = 0;
    let mut loss: u64 = 0;
    let mut total_fees: u64 = 0;

    burn_unlocked_shares(&ctx)?;
    ctx.accounts.vault_shares_token_account.reload()?;

    let current_debt = get_current_strategy_debt(&ctx.accounts.vault, strategy.key())?;

    if strategy_assets > current_debt {
        gain = strategy_assets - current_debt;
        handle_profit(&ctx, gain)?;

        if ctx.accounts.vault.load()?.performance_fee > 0 {
            total_fees = issue_fee_shares(&ctx, gain)?;
        }
    } else {
        loss = current_debt - strategy_assets;
        handle_loss(&ctx, loss)?;
    }

    ctx.accounts
        .vault
        .load_mut()?
        .update_strategy_current_debt(strategy.key(), strategy_assets)?;

    emit!(StrategyReportedEvent {
        strategy_key: strategy.key(),
        gain,
        loss,
        current_debt: strategy_assets,
        protocol_fees: 0, //TODO: this is set as 0
        total_fees,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

fn issue_fee_shares(ctx: &Context<ProcessReport>, profit: u64) -> Result<u64> {
    let vault = &mut ctx.accounts.vault.load_mut()?;
    let fee_shares = vault.convert_to_shares((profit * vault.performance_fee) / FEE_BPS);

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.shares_mint.to_account_info(),
                to: ctx.accounts.fee_shares_recipient.to_account_info(),
                authority: ctx.accounts.shares_mint.to_account_info(),
            },
            &[&vault.seeds_shares()],
        ),
        fee_shares,
    )?;

    vault.total_shares += fee_shares;
    Ok(fee_shares)
}

fn handle_profit(ctx: &Context<ProcessReport>, profit: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;
  
    let mut shares_to_lock = 0;
    if vault.profit_max_unlock_time != 0 {
        // we don't lock fee shares
        let amount_to_lock = profit - (profit * vault.performance_fee) / FEE_BPS;
        shares_to_lock = vault.convert_to_shares(amount_to_lock);

        let curr_locked_shares = ctx.accounts.vault_shares_token_account.amount;
        let newly_locked_shares = curr_locked_shares + shares_to_lock;
    
        let curr_timestamp = get_timestamp()?;

        let total_locked_shares = curr_locked_shares + newly_locked_shares;

        if total_locked_shares > 0 {
            let mut previously_locked_time = 0;
                
            if vault.full_profit_unlock_date > curr_timestamp {
                previously_locked_time =
                    curr_locked_shares * (vault.full_profit_unlock_date - curr_timestamp);
            }

            let new_profit_locking_period = (previously_locked_time
                + newly_locked_shares * vault.profit_max_unlock_time)
                / total_locked_shares;

            vault.profit_unlocking_rate =
                (total_locked_shares * MAX_BPS_EXTENDED) / new_profit_locking_period;
            vault.full_profit_unlock_date = curr_timestamp + new_profit_locking_period;
            vault.last_profit_update = curr_timestamp;
        } else {
            // NOTE: only setting this to 0 will turn in the desired effect, no need
            // to update lastProfitUpdate or fullProfitUnlockDate
            vault.profit_unlocking_rate = 0;
        }

        // mint shares to lock
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.shares_mint.to_account_info(),
                    to: ctx.accounts.vault_shares_token_account.to_account_info(),
                    authority: ctx.accounts.shares_mint.to_account_info(),
                },
                &[&vault.seeds_shares()],
            ),
            shares_to_lock,
        )?;
    }

    vault.total_debt += profit;
    vault.total_shares += shares_to_lock;

    Ok(())
}

fn handle_loss(ctx: &Context<ProcessReport>, loss: u64) -> Result<()> {
    let loss_shares = ctx.accounts.vault.load()?.convert_to_shares(loss);
    let shares_to_burn = std::cmp::min(ctx.accounts.vault_shares_token_account.amount, loss_shares);

    token::burn(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.shares_mint.to_account_info(),
                from: ctx.accounts.vault_shares_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[&ctx.accounts.vault.load()?.seeds()],
        ),
        shares_to_burn,
    )?;

    let vault = &mut ctx.accounts.vault.load_mut()?;
    vault.total_debt -= loss;
    vault.last_profit_update = get_timestamp()?;

    Ok(())
}

fn burn_unlocked_shares(ctx: &Context<ProcessReport>) -> Result<()> {
    let shares_to_burn: u64 = get_shares_to_burn(
        &ctx.accounts.vault, 
        ctx.accounts.vault_shares_token_account.amount
    )?;
   
    if shares_to_burn == 0 {
        return Ok(());
    }

    // Burn the shares unlocked.
    token::burn(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.shares_mint.to_account_info(),
                from: ctx.accounts.vault_shares_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[&ctx.accounts.vault.load()?.seeds()],
        ),
        shares_to_burn,
    )?;

    let mut vault = ctx.accounts.vault.load_mut()?;
    vault.total_shares -= shares_to_burn;

    Ok(())
}

fn get_shares_to_burn(vault_loader: &AccountLoader<Vault>, total_locked: u64) -> Result<u64> {
    let vault = vault_loader.load()?;
    let curr_timestamp = Clock::get()?.unix_timestamp as u64;
    let mut shares_to_burn = 0;

    if vault.full_profit_unlock_date > curr_timestamp {
        shares_to_burn = (vault.profit_unlocking_rate * (curr_timestamp - vault.last_profit_update))
            / MAX_BPS_EXTENDED;
    } else if vault.full_profit_unlock_date != 0 {
        shares_to_burn = total_locked;
    }

    if shares_to_burn > total_locked {
        shares_to_burn = total_locked;
    }

    Ok(shares_to_burn)
}

fn get_timestamp() -> Result<u64> {
    Ok(Clock::get()?.unix_timestamp as u64)
}

fn get_current_strategy_debt(
    vault_loader: &AccountLoader<Vault>,
    strategy_key: Pubkey,
) -> Result<u64> {
    let vault = vault_loader.load()?;
    let strategy_data = vault.get_strategy_data(strategy_key)?;
    Ok(strategy_data.current_debt)
}
