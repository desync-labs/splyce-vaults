use anchor_lang::prelude::*;

use crate::constants::DISCRIMINATOR_LEN;
use crate::events::VaultAddStrategyEvent;


#[account]
#[derive(Default, Debug, InitSpace)]
pub struct StrategyData {
    pub current_debt: u64,
    pub max_debt: u64,
    pub last_update: i64,
}

impl StrategyData {
    pub const LEN: usize = DISCRIMINATOR_LEN + StrategyData::INIT_SPACE;

    pub fn init(&mut self, vault_key: Pubkey, strategy_key: Pubkey, max_debt: u64) -> Result<()> {
        self.max_debt = max_debt;
        self.last_update = 0;

        emit!(VaultAddStrategyEvent {
            vault_key: vault_key,
            strategy_key: strategy_key,
            current_debt: 0,
            max_debt,
            last_update: 0,
            is_active: true,
        });

        Ok(())
    }

    pub fn update_current_debt(&mut self,  amount: u64) -> Result<()> {
        self.current_debt = amount;
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn increase_current_debt(&mut self, amount: u64) -> Result<()> {
        self.current_debt += amount;
        self.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

pub fn deserialize(acc_info: &AccountInfo) -> Result<Box<StrategyData>> {
    let data = acc_info.try_borrow_data()?;
    Ok(Box::new(StrategyData::try_from_slice(&data[8..]).unwrap()))
}

pub trait StrategyDataAccInfo {
    fn set_current_debt(&self, amount: u64) -> Result<()>;
    fn deserialize(&self) -> Result<Box<StrategyData>>;
    fn current_debt(&self) -> u64;

}

impl<'a> StrategyDataAccInfo for AccountInfo<'a> {
    fn deserialize(&self) -> Result<Box<StrategyData>> {
        let data = self.try_borrow_data()?;
        Ok(Box::new(StrategyData::try_from_slice(&data[8..]).unwrap()))
    }

    fn current_debt(&self) -> u64 {
        let data = self.try_borrow_data().unwrap();
        StrategyData::try_from_slice(&data[8..]).unwrap().current_debt
    }

    fn set_current_debt(&self, amount: u64) -> Result<()> {
        let mut data = self.try_borrow_mut_data()?;
        let mut strategy_data = StrategyData::try_from_slice(&data[8..]).unwrap();
        strategy_data.update_current_debt(amount)?;
        strategy_data.serialize(&mut &mut data[8..])?;
        Ok(())
    }
}