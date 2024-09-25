use anchor_lang::prelude::*;

use crate::state::*;
use crate::constants::ROLES_SEED;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct RemoveStrategy<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,
    #[account(seeds = [ROLES_SEED.as_bytes()], bump)]
    pub roles: Account<'info, Roles>,
    #[account(mut, address = roles.vaults_admin)]
    pub admin: Signer<'info>,
}

pub fn handle_remove_strategy(ctx: Context<RemoveStrategy>, strategy: Pubkey, force: bool) -> Result<()> {
    let vault = &mut ctx.accounts.vault.load_mut()?;
    let strategy_data = vault.get_strategy_data(strategy)?;

    if strategy_data.current_debt > 0 {
        if !force {
            return Err(ErrorCode::StrategyHasDebt.into());
        }
        let loss = strategy_data.current_debt;
        vault.total_debt -= loss;
    }

    vault.remove_strategy(strategy)?;

    Ok(())
}