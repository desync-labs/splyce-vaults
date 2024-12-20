use anchor_lang::prelude::*;
use anchor_spl::{
    token::{ Token },
    token_interface::Mint,
};
use access_control::{
    constants::USER_ROLE_SEED,
    program::AccessControl,
    state::{UserRole, Role}
};

use crate::constants::{INVEST_TRACKER_SEED, MAX_ASSIGNED_WEIGHT};
use crate::state::invest_tracker::*;
use crate::state::whirlpool::*;
use crate::error::ErrorCode;
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
    /// CHECK: This is a Whirlpool account owned by Orca's Whirlpool program. 
    /// The account ownership and data are not yet verified in the instruction handler.
    pub whirlpool: AccountInfo<'info>,

    /// CHECK: can be any strategy
    #[account(owner = ID)]
    pub strategy: UncheckedAccount<'info>,

    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,

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

pub fn handle_init_invest_tracker(ctx: Context<InitInvestTracker>, a_to_b_for_purchase: bool, assigned_weight: u16) -> Result<()> {
    msg!("Invest tracker initialized");
    let invest_tracker = &mut ctx.accounts.invest_tracker;
    
    // Deserialize the whirlpool account
    let account_data = ctx.accounts.whirlpool.data.borrow();
    let whirlpool = Whirlpool::try_from_slice(&account_data[8..])?;
    
    let asset_mint = &ctx.accounts.asset_mint;
    let underlying_mint = &ctx.accounts.underlying_mint;
    if a_to_b_for_purchase {
        require!(
            whirlpool.token_mint_a == underlying_mint.key() &&
            whirlpool.token_mint_b == asset_mint.key(),
            ErrorCode::InvalidTrackerSetup
        );
    } else {
        require!(
            whirlpool.token_mint_a == asset_mint.key() &&
            whirlpool.token_mint_b == underlying_mint.key(),
            ErrorCode::InvalidTrackerSetup
        );
    }
    invest_tracker.whirlpool_id =  ctx.accounts.whirlpool.key();
    invest_tracker.asset_mint = asset_mint.key();
    invest_tracker.amount_invested = 0;
    invest_tracker.amount_withdrawn = 0;
    invest_tracker.asset_amount = 0;
    invest_tracker.asset_price = 0;
    invest_tracker.sqrt_price = whirlpool.sqrt_price;
    invest_tracker.asset_value = 0;
    invest_tracker.asset_decimals = asset_mint.decimals;
    invest_tracker.underlying_decimals = underlying_mint.decimals;
    invest_tracker.a_to_b_for_purchase = a_to_b_for_purchase;
    require!(assigned_weight <= MAX_ASSIGNED_WEIGHT, ErrorCode::InvalidTrackerSetup);
    invest_tracker.assigned_weight = assigned_weight;
    invest_tracker.current_weight = assigned_weight;
    invest_tracker.effective_invested_amount = 0;
    invest_tracker.unrealized_profit = 0;
    invest_tracker.unrealized_loss = 0;
    Ok(())
}