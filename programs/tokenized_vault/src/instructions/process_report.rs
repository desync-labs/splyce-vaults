use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, MintTo, Token, TokenAccount, Transfer},
};
// use strategy_program::utils::strategy;

use crate::state::*;
use crate::error::ErrorCode::*;
use crate::utils::token::*;
use crate::utils::strategy;

#[derive(Accounts)]
pub struct ProcessReport<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: is this a right way to do it?
    #[account()]
    pub strategy: AccountInfo<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub shares_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub shares_mint: Account<'info, Mint>,
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
        vault.total_debt += gain;
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

/*
    function assessFees(address strategy, uint256 gain, uint256 loss, address accountant, address factory) public returns (FeeAssessment memory) {
        FeeAssessment memory fees = FeeAssessment(0, 0, 0, address(0));

        if (accountant != address(0x00)) {
            (fees.totalFees, fees.totalRefunds) = ((gain * _performanceFee) / FEE_BPS, 0)
            if (fees.totalFees > 0) {
                uint16 protocolFeeBps;
                // Get the config for this vault.
                (protocolFeeBps, fees.protocolFeeRecipient) = IFactory(factory).protocolFeeConfig();

                if (protocolFeeBps > 0) {
                    if (protocolFeeBps > MAX_BPS) {
                        revert FeeExceedsMax();
                    }
                    // Protocol fees are a percent of the fees the accountant is charging.
                    fees.protocolFees = (fees.totalFees * uint256(protocolFeeBps)) / MAX_BPS;
                    // 1000 * 2000 / 10000 = 200
                }
            }
        }

        return fees;
    }

   // Make sure we have a valid strategy.
        if (strategies[strategy].activation == 0) {
            revert InactiveStrategy(strategy);
        }

        // Burn shares that have been unlocked since the last update
        _burnUnlockedShares();

        uint256 currentTotalSupply = _totalSupply();
        uint256 currentTotalAssets = _totalAssets();

        ReportInfo memory report = VaultLogic.processReport(
            strategy,
            strategies[strategy].currentDebt,
            currentTotalSupply,
            currentTotalAssets,
            accountant,
            factory
        );

        _handleShareBurnsAndIssues(report.gain, report.loss, report.shares, report.assessmentFees, strategy);

        // Record the report of profit timestamp.
        strategies[strategy].lastReport = block.timestamp;

        // We have to recalculate the fees paid for cases with an overall loss.
        emit StrategyReported(
            strategy,
            report.gain,
            report.loss,
            strategies[strategy].currentDebt,
            report.protocolFees,
            report.totalFees,
            report.assessmentFees.totalRefunds
        );

        return (report.gain, report.loss);
*/