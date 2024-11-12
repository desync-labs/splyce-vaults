use anchor_lang::prelude::*;

declare_id!("8y6Berpbq9Vcdd492dHqy2RsbTxg2DCnbkbXDXSzCqVg");

#[program]
pub mod deposit_limit {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
