use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod error;

pub use instructions::*;

declare_id!("78tJk8XAhSQL6qNbZ1fbgZXAh7DnsHW6H1TmZmpTNaZX");

#[program]
pub mod faucet {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::init(ctx)
    }

    pub fn send_tokens(ctx: Context<SendTokens>) -> Result<()> {
        instructions::send_tokens(ctx)
    }

    pub fn set_distribution_amount(ctx: Context<SetDistributionAmount>, amount: u64) -> Result<()> {
        instructions::set_distribution_amount(ctx, amount)
    }
}