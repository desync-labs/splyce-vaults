use anchor_lang::prelude::*;

use crate::state::FaucetData;

#[derive(Accounts)]
pub struct SetDistributionAmount<'info> {
    #[account(mut, seeds = ["data".as_bytes()], bump)]
    pub faucet_data: Account<'info, FaucetData>,

    #[account(mut, address = faucet_data.owner)]
    pub signer: Signer<'info>,
}

pub fn set_distribution_amount(ctx: Context<SetDistributionAmount>, amount: u64)-> Result<()> {
    let data = &mut ctx.accounts.faucet_data;
    data.amount = amount * 10u64.pow(data.decimals as u32);
    Ok(())
}
