use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Token, TokenAccount},
    token_interface::Mint as InterfaceMint,
};
// use borsh::de;
use std::{ mem::size_of };

use crate::constants::*;
use crate::error::ErrorCode::InvalidStrategyConfig;
use crate::state::*;


#[derive(Accounts)]
#[instruction(strategy_type: StrategyType)]
pub struct AddStrategy<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: we need to create a new account for each strategy type
    #[account(
        init,
        seeds = [
            b"strategy".as_ref(),
            vault.key().as_ref(),
            strategy_type.to_seed().as_ref()
        ],
        bump,
        payer = admin,
        space = space_for_strategy(&strategy_type) + 8,
    )]
    pub strategy: UncheckedAccount<'info>, // AccountInfo can represent any strategy
    #[account(
        init, 
        seeds = [UNDERLYING_SEED.as_bytes(), strategy.key().as_ref()], 
        bump, 
        payer = admin, 
        token::mint = underlying_mint,
        token::authority = strategy,
    )]
    pub strategy_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub underlying_mint: Box<InterfaceAccount<'info, InterfaceMint>>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

fn space_for_strategy(strategy_type: &StrategyType) -> usize {
    match strategy_type {
        StrategyType::TradeFintech => size_of::<TradeFintechStrategy>(),
        default => unimplemented!("Strategy type not implemented: {:?}", default),
    }
}

pub fn handler(
    ctx: Context<AddStrategy>, 
    strategy_type: StrategyType, 
    config_data: Vec<u8> // Serialized configuration data
) -> Result<()> {
    let mut vault = &mut ctx.accounts.vault;

    match strategy_type {
        StrategyType::TradeFintech => {
            let mut strategy: TradeFintechStrategy = TradeFintechStrategy::default();
            let config = TradeFintechConfig::try_from_slice(&config_data).map_err(|_| InvalidStrategyConfig)?;
            strategy.init(
                ctx.bumps.strategy, 
                vault.key(), 
                ctx.accounts.underlying_mint.as_ref(), 
                ctx.accounts.strategy_token_account.as_ref().key(), 
                config);
        }
        default => unimplemented!("Strategy type not implemented: {:?}", default),
    }

    msg!("strategy key: {:?}", ctx.accounts.strategy.key());

    vault.add_strategy(ctx.accounts.strategy.key());
    Ok(())
}