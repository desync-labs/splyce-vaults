use anchor_lang::prelude::*;

declare_id!("Dp4rU1YLRF6fjANr78N7iCGWFKTAd6U9ZimxkRSPNYky");

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
