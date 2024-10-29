use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;
use crate::state::*;

declare_id!("49pfysnCNyz6HrKsTUaKtyp8DPcXQadjkS5qBJPJKEnJ");

#[derive(Accounts)]
pub struct RegAcc<'info> {
    #[account()]
    pub generic: Account<'info, GenericAccountant>,
}

#[program]
pub mod accountant {
    use super::*;

    // the only reason we need this is to keep accounts in the idl file
    pub fn register_accounts(_ctx: Context<RegAcc>) -> Result<()> {
        Ok(())
    }

    pub fn init(ctx: Context<Initialize>) -> Result<()> {
        handle_initialize(ctx)
    }

    pub fn init_accountant(
        ctx: Context<InitAccountant>,
        accountant_type: AccountantType,
    ) -> Result<()> {
        handle_init_accountant(ctx, accountant_type)
    }

    pub fn init_token_account(ctx: Context<InitTokenAccount>) -> Result<()> {
        handle_init_token_acc(ctx)
    }

    pub fn distribute(ctx: Context<Distribute>) -> Result<()> {
        handle_distribute(ctx)
    }

    pub fn set_fee(ctx: Context<SetFee>, fee: u64) -> Result<()> {
        handle_set_fee(ctx, fee)
    }

    pub fn set_fee_recipient(ctx: Context<SetFeeRecipient>, recipient: Pubkey) -> Result<()> {
        handle_set_fee_recipient(ctx, recipient)
    }
}
