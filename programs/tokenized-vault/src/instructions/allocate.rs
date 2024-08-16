use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Token, TokenAccount, Transfer},
};
use crate::error::ErrorCode::InvalidAccountType;
use crate::error::ErrorCode::InvalidStrategyConfig;

use crate::state::*;

// #[derive(Accounts)]
// pub struct AllocateToStrategy<'info> {
//     #[account(mut)]
//     pub vault: Account<'info, Vault>,
//     #[account(mut)]
//     pub vault_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub strategy: Account<'info, StrategyEnum>,
//     #[account(mut)]
//     pub strategy_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub admin: Signer<'info>,
//     pub token_program: Program<'info, Token>,
// }


#[derive(Accounts)]
pub struct AllocateToStrategy<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    /// CHECK: Should this be mut?
    #[account(mut)]
    pub strategy: UncheckedAccount<'info>,
    #[account(mut)]
    pub strategy_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}


pub fn handler(
    ctx: Context<AllocateToStrategy>, 
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.strategy_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            }, 
            &[&ctx.accounts.vault.seeds()]
        ), 
        amount)?;
    
        let strategy_a = ctx.accounts.strategy.to_account_info();//.map_err(|_| InvalidAccountType)?;
        let strategy_a = TradeFintechStrategy::try_from(strategy_a)?;


        // let mut strategy = &mut ctx.accounts.strategy.as_ref();
        
        // match &mut *ctx.accounts.strategy {
        //     StrategyEnum::TradeFintechStrategy(strategy) => {
        //         // Handle allocation for ConcreteStrategy1
        //         strategy.deposit(amount)?;
        //     },
        //     // Add other strategies here
        // }
    
    // strategy.deposit(amount)?;

    Ok(())
}