use anchor_lang::prelude::*;

use crate::constants::WHITELIST_SEED;
use crate::constants::ROLES_SEED;
use crate::state::whitelist::*;
use crate::state::roles::*;

#[derive(Accounts)]
#[instruction(account_to_add: Pubkey)]
pub struct WhitelistAccount<'info> {
    #[account(
        init, 
        seeds = [
            WHITELIST_SEED.as_bytes(),
            account_to_add.key().as_ref()
        ], 
        bump,  
        payer = signer, 
        space = Whitelist::LEN,
    )]
    pub whitelist: Account<'info, Whitelist>,
    #[account(seeds = [ROLES_SEED.as_bytes()], bump)]
    pub roles: Account<'info, Roles>,
    #[account(mut, address = roles.protocol_admin)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(account_to_remove: Pubkey)]
pub struct RemoveFromWhitelist<'info> {
    #[account(
        mut,
        close = signer,
        seeds = [
            WHITELIST_SEED.as_bytes(),
            account_to_remove.as_ref()
        ],
        bump,
    )]
    pub whitelist: Account<'info, Whitelist>,
    #[account(
        seeds = [ROLES_SEED.as_bytes()],
        bump,
    )]
    pub roles: Account<'info, Roles>,
    #[account(mut, address = roles.protocol_admin)]
    pub signer: Signer<'info>,
}
     
pub fn handle_whitelist(ctx: Context<WhitelistAccount>, account_to_add: Pubkey) -> Result<()> {
    let whitelist = &mut ctx.accounts.whitelist;
    whitelist.whitelisted_account = account_to_add;
    Ok(())
}

pub fn handle_remove_from_whitelist(_ctx: Context<RemoveFromWhitelist>, _account_to_remove: Pubkey) -> Result<()> {
    Ok(())
}
