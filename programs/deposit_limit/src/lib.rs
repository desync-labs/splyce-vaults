use anchor_lang::prelude::*;

declare_id!("B3o9MgocmVyMQM7Y3DQCAhk1xAA8kH5KmBdsF2fak9yd");

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
