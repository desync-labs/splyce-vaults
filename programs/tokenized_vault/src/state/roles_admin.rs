use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug)]
pub struct RolesAdmin {
    pub account: Pubkey,
}

impl RolesAdmin {
    pub const LEN: usize = 8 + 32;
}