use anchor_lang::prelude::*;

use crate::state::*;
use crate::constants::ROLES_SEED;

#[derive(Accounts)]
pub struct SetDepositLimit<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [ROLES_SEED.as_bytes()], 
        bump,  
    )]
    pub roles_data: Account<'info, Roles>,
    #[account(
        mut,
        address = roles_data.vaults_admin
    )]
    pub admin: Signer<'info>,
}

pub fn handle_set_deposit_limit(ctx: Context<SetDepositLimit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.deposit_limit = amount;

    Ok(())
}
