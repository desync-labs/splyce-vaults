use anchor_lang::prelude::*;

declare_id!("HZekas7DsEfpg6JvU9wsGNUSy9E3fu9TGeVerMdvDBwc");

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
