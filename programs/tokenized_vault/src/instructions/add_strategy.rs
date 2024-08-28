use anchor_lang::prelude::*;

use crate::state::*;
use crate::constants::*;

#[derive(Accounts)]
pub struct AddStrategy<'info> {
    // #[account(
    //     init,
    //     seeds = [
    //         STRATEGY_SEED.as_bytes(),
    //         vault.key().as_ref(),
    //         strategy.key().as_ref()
    //     ],
    //     bump,  
    //     payer = admin,
    //     space = StrategyData::LEN,
    // )]
    // pub strategy_data: Account<'info, StrategyData>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: is this a right way to do it?
    #[account()]
    pub strategy: AccountInfo<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_add_strategy(ctx: Context<AddStrategy>, max_debt: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.add_strategy(ctx.accounts.strategy.key(), max_debt)

    // let strategy_data = &mut ctx.accounts.strategy_data;
    // // strategy_data.strategy = *ctx.accounts.strategy.key();
    // strategy_data.is_active = true;
    // strategy_data.max_debt = max_debt;
    
    // Ok(())
}