use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::events::StrategyReportedEvent;
use crate::state::*;
use crate::utils::strategy;
use crate::constants::{ FEE_BPS, ROLES_SEED };

#[derive(Accounts)]
pub struct ProcessReport<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,
    /// CHECK: is this a right way to do it?
    #[account()]
    pub strategy: AccountInfo<'info>,
    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Account<'info, AccountRoles>,
    #[account(mut, constraint = roles.is_reporting_manager)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub shares_mint: Account<'info, Mint>,
    #[account(mut)]
    pub fee_shares_recipient: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_process_report(ctx: Context<ProcessReport>) -> Result<()> {
    let fee_shares_to_mint = handle_internal(&ctx)?;

    // Transfer fees to fee share token account
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            MintTo {
                mint: ctx.accounts.shares_mint.to_account_info(),
                to: ctx.accounts.fee_shares_recipient.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            }, 
            &[&ctx.accounts.vault.load()?.seeds()]
        ), 
        fee_shares_to_mint
    )?;
    
    Ok(())
}

fn handle_internal(ctx: &Context<ProcessReport>) -> Result<u64> {
    let strategy_assets = strategy::get_total_assets(&ctx.accounts.strategy)?;
    let vault = &mut ctx.accounts.vault.load_mut()?;
    let strategy = &ctx.accounts.strategy;
    let strategy_data = vault.get_strategy_data_mut(strategy.key())?;

    let mut fee_shares = 0;
    let mut gain: u64 = 0;
    let mut loss: u64 = 0;
    let mut total_fees: u64 = 0;

    if strategy_assets > strategy_data.current_debt {
        // We have a gain.
        gain = strategy_assets - strategy_data.current_debt;

        // calculate fees
        vault.total_debt += gain;

        total_fees = (gain * vault.performance_fee) / FEE_BPS;
        fee_shares = vault.convert_to_shares(total_fees);

        vault.total_shares += fee_shares;
    } else {
        // We have a loss.
        loss = strategy_data.current_debt - strategy_assets;
        vault.total_debt -= loss;
    }

    let strategy_data = vault.get_strategy_data_mut(strategy.key())?;
    strategy_data.current_debt = strategy_assets;
    strategy_data.last_update = Clock::get()?.unix_timestamp;

    emit!(StrategyReportedEvent {
        strategy_key: strategy.key(),
        gain,
        loss,
        current_debt: strategy_data.current_debt,
        protocol_fees: 0, //TODO: this is set as 0
        total_fees,
        timestamp: strategy_data.last_update,
    });

    Ok(fee_shares)
}

// fn burn_unlocked_shares(vault: Vault) -> Result<()> {
//     let curr_unlocked_shares;
//     if vault.full_profit_unlock_date > Clock::get()?.unix_timestamp {
//         curr_unlocked_shares = (vault.profit_unlocking_rate * (Clock::get()?.unix_timestamp - vault.last_profit_update)) / MAX_BPS_EXTENDED;
//     } else if vault.full_profit_unlock_date != 0 {
//         curr_unlocked_shares = vault.shares_balance_of[&vault.to_account_info()];
//     }

//     if curr_unlocked_shares == 0 {
//         return Ok(());

//     // Only do an SSTORE if necessary
//     if vault.full_profit_unlock_date > Clock::get()?.unix_timestamp {
//         vault.last_profit_update = Clock::get()?.unix_timestamp;
//     }

//     // Burn the shares unlocked.
//     vault.burn_shares(curr_unlocked_shares, &vault.to_account_info());
//     Ok(())
// }

// fn manage_unlocking_of_shares(vault: Vault, previously_locked_shares: u64, newly_locked_shares: u64) -> Result<()> {
//     let total_locked_shares = previously_locked_shares + newly_locked_shares;
//     if total_locked_shares > 0 {
//         let mut previously_locked_time;
//         if vault.full_profit_unlock_date > Clock::get()?.unix_timestamp {
//             previously_locked_time = previously_locked_shares * (vault.full_profit_unlock_date - Clock::get()?.unix_timestamp);
//         }

//         let new_profit_locking_period = (previously_locked_time + newly_locked_shares * vault.profit_max_unlock_time) / total_locked_shares;
//         vault.profit_unlocking_rate = (total_locked_shares * MAX_BPS_EXTENDED) / new_profit_locking_period;
//         vault.full_profit_unlock_date = Clock::get()?.unix_timestamp + new_profit_locking_period;
//         vault.last_profit_update = Clock::get()?.unix_timestamp;
//     } else {
//         // NOTE: only setting this to 0 will turn in the desired effect, no need
//         // to update lastProfitUpdate or fullProfitUnlockDate
//         vault.profit_unlocking_rate = 0;
//     }
//     Ok(())
// }