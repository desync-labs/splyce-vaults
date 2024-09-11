use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::state::*;
use crate::utils::strategy;
use crate::constants::{ FEE_BPS, ROLES_SEED };

#[derive(Accounts)]
pub struct ProcessReport<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: is this a right way to do it?
    #[account()]
    pub strategy: AccountInfo<'info>,
    #[account(seeds = [ROLES_SEED.as_bytes()], bump)]
    pub roles: Account<'info, Roles>,
    #[account(mut, address = roles.reporting_manager)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub shares_mint: Account<'info, Mint>,
    #[account(mut)]
    pub fee_shares_recipient: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_process_report(ctx: Context<ProcessReport>) -> Result<()> {
    let strategy_assets = strategy::get_total_assets(&ctx.accounts.strategy)?;
    let vault = &mut ctx.accounts.vault;
    let strategy = &mut ctx.accounts.strategy;
    let strategy_data = vault.get_strategy_data(strategy.key())?;

    if strategy_assets > strategy_data.current_debt {
        // We have a gain.
        let gain = strategy_assets - strategy_data.current_debt;

        // calculate fees
        vault.total_debt += gain;

        let total_fees = (gain * vault.performance_fee) / FEE_BPS;
        let fee_shares = vault.convert_to_shares(total_fees);

        // Transfer fees to fee share token account

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(), 
                MintTo {
                    mint: ctx.accounts.shares_mint.to_account_info(),
                    to: ctx.accounts.fee_shares_recipient.to_account_info(),
                    authority: vault.to_account_info(),
                }, 
                &[&vault.seeds()]
            ), 
            fee_shares
        )?;

        vault.total_shares += fee_shares;
    } else {
        // We have a loss.
        let loss = strategy_data.current_debt - strategy_assets;
        vault.total_debt -= loss;
    }

    let strategy_data = vault.get_strategy_data_mut(strategy.key())?;
    strategy_data.current_debt = strategy_assets;
    strategy_data.last_update = Clock::get()?.unix_timestamp;

    Ok(())
}
