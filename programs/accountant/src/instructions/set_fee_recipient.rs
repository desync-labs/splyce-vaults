use anchor_lang::prelude::*;
use access_control::{
    constants::ROLES_SEED,
    program::AccessControl,
    state::AccountRoles
};

use crate::utils::serialization;

#[derive(Accounts)]
pub struct SetFeeRecipient<'info> {
    /// CHECK: can be any accountant
    #[account(mut)]
    pub accountant: UncheckedAccount<'info>,

    #[account(
        seeds = [ROLES_SEED.as_bytes(), signer.key().as_ref()], 
        bump,
        seeds::program = access_control.key()
    )]
    pub roles: Account<'info, AccountRoles>,

    #[account(mut, constraint = roles.only_accountant_admin()?)]
    pub signer: Signer<'info>,

    pub access_control: Program<'info, AccessControl>
}

pub fn handle_set_fee_recipient(
    ctx: Context<SetFeeRecipient>, 
    recipient: Pubkey,
) -> Result<()> {
    let mut accountant = serialization::from_unchecked(&ctx.accounts.accountant)?;

    accountant.set_fee_recipient(recipient)?;
    accountant.save_changes(&mut &mut ctx.accounts.accountant.try_borrow_mut_data()?[8..])
}