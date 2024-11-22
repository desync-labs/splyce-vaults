use anchor_lang::prelude::*;
use anchor_spl::{
    token::{ Token, TokenAccount},
    token_interface::Mint,
};
use access_control::{
    constants::USER_ROLE_SEED,
    program::AccessControl,
    state::{UserRole, Role}
};

use crate::constants::INVEST_TRACKER_SEED;
use crate::state::invest_tracker::*;

use crate::ID;

//This instruction initializes an invest tracker for the strategy
#[derive(Accounts)]
#[instruction()]
pub struct InitInvestTracker<'info> {
    #[account(
        init, 
        space = 8 + InvestTracker::INIT_SPACE,
        seeds = [
            INVEST_TRACKER_SEED.as_bytes(),
            &asset_mint.key().to_bytes(),
            strategy.key().as_ref(),
        ], 
        bump, 
        payer = signer, 
    )]
    pub invest_tracker: Box<Account<'info, InvestTracker>>,

    /// CHECK: can be any strategy
    #[account(owner = ID)]
    pub strategy: UncheckedAccount<'info>,

    #[account(mut)]
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        seeds = [
            USER_ROLE_SEED.as_bytes(), 
            signer.key().as_ref(),
            Role::StrategiesManager.to_seed().as_ref()
        ], 
        bump,
        seeds::program = access_control.key()
    )]
    pub roles: Account<'info, UserRole>,

    #[account(mut, constraint = roles.check_role()?)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub access_control: Program<'info, AccessControl>,
}

pub fn handle_init_invest_tracker(ctx: Context<InitInvestTracker>, a_to_b_for_purchase: bool) -> Result<()> {
    msg!("Invest tracker initialized");
    let invest_tracker = &mut ctx.accounts.invest_tracker;
    invest_tracker.amount_invested = 0;
    invest_tracker.amount_withdrawn = 0;
    invest_tracker.asset_amount = 0;
    invest_tracker.asset_price = 0;
    invest_tracker.a_to_b_for_purchase = a_to_b_for_purchase;
    Ok(())
}