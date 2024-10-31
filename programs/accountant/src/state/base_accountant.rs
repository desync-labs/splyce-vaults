use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

use crate::instructions::Distribute;
use crate::state::GenericAccountant;

const DISCRIMINATOR_LEN: usize = 8;

pub trait Accountant {
    fn init(&mut self, index: u64, bump: u8) -> Result<()>;

    fn report(&self, profit: u64, loss: u64) -> Result<(u64,u64)>;
    fn distribute(&mut self, accounts: &Distribute) -> Result<()>;
    fn set_fee_recipient(&mut self, recipient: Pubkey) -> Result<()>;
    fn set_fee(&mut self, fee: u64) -> Result<()>;

    fn performance_fee(&self) -> u64;
    fn fee_recipient(&self) -> Pubkey;

    fn seeds(&self) -> [&[u8]; 2];
    fn save_changes(&self, writer: &mut dyn std::io::Write) -> Result<()>;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum AccountantType {
    Generic,
}

impl AccountantType {
    pub fn space(&self) -> usize {
        match self {
            AccountantType::Generic => DISCRIMINATOR_LEN + GenericAccountant::INIT_SPACE,
        }
    }
}