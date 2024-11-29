use anchor_lang::prelude::*;

use crate::constants::DISCRIMINATOR_LEN;

#[account]
#[derive(Default, Debug, InitSpace)]
pub struct Whitelisted {
    pub is_whitelisted: bool,
}

impl Whitelisted {
    pub const LEN: usize = DISCRIMINATOR_LEN + Whitelisted::INIT_SPACE;
    
}

pub trait WhitelistedAccInfo {
    fn deserialize(&self) -> Result<Box<Whitelisted>>;
    fn is_whitelisted(&self) -> bool;
}

impl<'a> WhitelistedAccInfo for AccountInfo<'a> {
    fn deserialize(&self) -> Result<Box<Whitelisted>> {
        let data = self.try_borrow_data()?;
        Ok(Box::new(Whitelisted::try_from_slice(&data[8..]).unwrap()))
    }

    fn is_whitelisted(&self) -> bool {
        let data = self.try_borrow_data().unwrap();
        if data.len() == 0 {
            return false;
        }
        let roles = Whitelisted::try_from_slice(&data[8..]);
        if roles.is_err() {
            return false;
        }
        roles.unwrap().is_whitelisted
    }
}