use anchor_lang::prelude::*;

declare_id!("DERtm15fgAGFpJWqERMNCptQ6DKdP7NJtcejiPtTLovW");

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
