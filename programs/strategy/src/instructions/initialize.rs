use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

use anchor_spl::{
    token::{ Token, TokenAccount},
    token_interface::Mint as InterfaceMint,
};
use crate::constants::UNDERLYING_SEED;
use crate::constants::STRATEGY_SEED;
use crate::state::*;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(strategy_type: StrategyType)]
pub struct Initialize<'info> {
    /// CHECK: We want to hadle all strategy types here
    #[account(
        init, 
        seeds = [
            &strategy_type.to_seed(), 
            vault.key().as_ref()
        ], 
        bump,  
        payer = admin, 
        space = strategy_type.space(),
    )]
    pub strategy: UncheckedAccount<'info>,
    #[account(
        init, 
        seeds = [
            strategy.key().as_ref(),
            UNDERLYING_SEED.as_bytes()
            ], 
        bump, 
        payer = admin, 
        token::mint = underlying_mint, 
        token::authority = strategy,
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: This should be a vault account
    #[account()]
    pub vault: AccountInfo<'info>,
    #[account(mut)]
    pub underlying_mint: Box<InterfaceAccount<'info, InterfaceMint>>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// TODO: make single fn for all strategies
pub fn initialize<T>(ctx: Context<Initialize>, config: Vec<u8>) -> Result<()> 
    where
        T: Strategy + anchor_lang::AnchorDeserialize + anchor_lang::AnchorSerialize + Discriminator + Default
{
    let strategy = &mut ctx.accounts.strategy;
    let strategy_info = strategy.to_account_info();

    let mut strategy_data = T::default();
    let mut data = strategy_info.data.borrow_mut();
    // we need to set the discriminator to the first 8 bytes of the account data
    data[..8].copy_from_slice(&T::discriminator());

    strategy_data.init(
        ctx.bumps.strategy,
        ctx.accounts.vault.key(),
        ctx.accounts.underlying_mint.as_ref(),
        ctx.accounts.token_account.key(),
        config
    );

    // Serialize the strategy data into the account
    strategy_data.serialize(&mut &mut data[8..])?;

    Ok(())
}