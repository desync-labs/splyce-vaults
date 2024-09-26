use anchor_lang::prelude::*;

use crate::events::StrategyReportedEvent;
use crate::state::*;
use crate::constants::ROLES_SEED;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct RemoveStrategy<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,
    #[account(seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], bump)]
    pub roles: Account<'info, AccountRoles>,
    #[account(mut, constraint = roles.is_vaults_admin)]
    pub signer: Signer<'info>,
}

pub fn handle_remove_strategy(ctx: Context<RemoveStrategy>, strategy: Pubkey, force: bool) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;
    let strategy_data = vault.get_strategy_data(strategy)?;

    let mut loss: u64 = 0;

    if strategy_data.current_debt > 0 {
        if !force {
            return Err(ErrorCode::StrategyHasDebt.into());
        }
        loss = strategy_data.current_debt;
        vault.total_debt -= loss;
    }

    vault.remove_strategy(strategy)?;

    emit!(StrategyReportedEvent {
        strategy_key: strategy,
        gain: 0,
        loss,
        current_debt: 0,
        protocol_fees: 0,
        total_fees: 0,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}