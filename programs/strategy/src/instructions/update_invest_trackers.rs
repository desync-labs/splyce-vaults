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
use crate::state::whirlpool::*;
use crate::error::ErrorCode;

use crate::ID;

//This instruction initializes an invest tracker for the strategy
#[derive(Accounts)]
#[instruction()]
pub struct UpdateInvestTrackers<'info> {
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

pub fn handle_update_invest_trackers(ctx: Context<UpdateInvestTrackers>) -> Result<()> {
    msg!("Updating invest trackers");
    //so there would be a pair of accounts for each invest tracker
    //remaining accounts[0] = invest_tracker
    //remaining accounts[1] = whirlpool
    //need to loop thorugh the remaining accounts by pairs

    //require that the sum of all assigned weights is 100%

    let remaining_accounts = &ctx.remaining_accounts;
    require!(remaining_accounts.len() % 2 == 0, ErrorCode::InvalidAccount);

    let mut total_weight: u16 = 0;

    for chunk in remaining_accounts.chunks(2) {
        let invest_tracker_info = &chunk[0];
        let whirlpool_info = &chunk[1];

        // Verify the invest tracker account is writable
        if !invest_tracker_info.is_writable {
            return Err(ProgramError::InvalidAccountData.into());
        }

        // Get account data
        let mut account_data = invest_tracker_info.try_borrow_mut_data()?;
        let whirlpool_data = whirlpool_info.try_borrow_data()?;

        // First read the current data
        let mut current_data = InvestTracker::try_from_slice(&account_data[8..])?;
        let whirlpool = Whirlpool::try_from_slice(&whirlpool_data[8..])?;

        // Verify whirlpool matches tracker
        require!(
            current_data.whirlpool_id == whirlpool_info.key(),
            ErrorCode::InvalidAccount
        );

        // Update sqrt_price
        current_data.sqrt_price = whirlpool.sqrt_price;

        // Serialize the updated data
        let serialized = current_data.try_to_vec()?;

        // Write the updated data
        account_data[8..].copy_from_slice(&serialized);

        total_weight += current_data.assigned_weight as u16;
    }

    // Verify total weight is 100%
    require!(total_weight == MAX_ASSIGNED_WEIGHT as u16, ErrorCode::InvalidTrackerSetup);

    Ok(())
}