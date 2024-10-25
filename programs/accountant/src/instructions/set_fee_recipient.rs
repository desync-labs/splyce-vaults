use anchor_lang::prelude::*;

use crate::utils::serialization;
use crate::state::Config;
use crate::constants::CONFIG_SEED;

#[derive(Accounts)]
pub struct SetFeeRecipient<'info> {
    /// CHECK: can be any accountant
    #[account(mut)]
    pub accountant: UncheckedAccount<'info>,

    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump)]
    pub config: Account<'info, Config>,

    /// CHECK: This should be a vault account
    #[account(mut, address = config.admin)]
    pub signer: Signer<'info>,
}

pub fn handle_set_fee_recipient(
    ctx: Context<SetFeeRecipient>, 
    recipient: Pubkey,
) -> Result<()> {
    let mut accountant = serialization::from_unchecked(&ctx.accounts.accountant)?;

    accountant.set_fee_recipient(recipient)?;
    accountant.save_changes(&mut &mut ctx.accounts.accountant.try_borrow_mut_data()?[8..])
}