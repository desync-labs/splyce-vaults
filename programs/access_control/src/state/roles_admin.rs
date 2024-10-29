use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct RolesAdmin {
    pub account: Pubkey,
}