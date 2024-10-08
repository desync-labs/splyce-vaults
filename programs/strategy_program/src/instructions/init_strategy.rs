use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

use anchor_spl::{
    token::{ Token, TokenAccount},
    token_interface::Mint as InterfaceMint,
};
use crate::constants::UNDERLYING_SEED;
use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(index: u8, strategy_type: StrategyType)]
pub struct Initialize<'info> {
    /// CHECK: We want to hadle all strategy types here
    #[account(
        init, 
        seeds = [
            vault.key().as_ref(),
            index.to_le_bytes().as_ref()
        ], 
        bump,  
        payer = signer, 
        space = strategy_type.space(),
    )]
    pub strategy: UncheckedAccount<'info>,
    #[account(
        init, 
        seeds = [
            UNDERLYING_SEED.as_bytes(),
            strategy.key().as_ref(),
        ], 
        bump, 
        payer = signer, 
        token::mint = underlying_mint, 
        token::authority = strategy,
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: This should be a vault account
    #[account()]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub underlying_mint: Box<InterfaceAccount<'info, InterfaceMint>>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_init_strategy(ctx: Context<Initialize>, index: u8, strategy_type: StrategyType, config: Vec<u8>) -> Result<()> {
    match strategy_type {
        StrategyType::Simple => {
            return init_strategy_internal::<SimpleStrategy>(ctx, index, config)
        }
        StrategyType::TradeFintech => {
            return init_strategy_internal::<TradeFintechStrategy>(ctx, index, config)
        }
        _ => {
            return Err(ErrorCode::InvalidStrategyData.into())
        }
    }
}

fn init_strategy_internal<T>(ctx: Context<Initialize>, index: u8, config: Vec<u8>) -> Result<()> 
where 
    T: Strategy + AnchorDeserialize + AnchorSerialize + Discriminator + Default
{
    let strategy_acc = &mut ctx.accounts.strategy;
    let strategy_info = strategy_acc.to_account_info();

    let mut strategy = T::default();
    let mut data = strategy_info.data.borrow_mut();
    // we need to set the discriminator to the first 8 bytes of the account data
    data[..8].copy_from_slice(&T::discriminator());

    strategy.init(
        ctx.bumps.strategy,
        index,
        ctx.accounts.vault.key(),
        ctx.accounts.underlying_mint.as_ref(),
        ctx.accounts.token_account.key(),
        config,
    )?;
    strategy.set_manager(ctx.accounts.signer.key())?;

    // Serialize the strategy data into the account
    strategy.save_changes(&mut &mut data[8..])?;

    Ok(())
}
