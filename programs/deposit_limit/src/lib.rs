use anchor_lang::prelude::*;

declare_id!("A9UGcMArUNTjnfLeWtn37JKCLyd8GZqfTwYxwkR7LiUN");

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
