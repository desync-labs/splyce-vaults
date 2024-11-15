use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct RoleManager {
    pub manager_role_id: u64,
}