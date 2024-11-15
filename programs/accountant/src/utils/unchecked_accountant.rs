use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

use crate::state::*;
use crate::error::ErrorCode;
use crate::state::GenericAccountant;

pub trait UncheckedAccountant {
    fn get_discriminator(&self) -> Result<[u8; 8]>;
    fn from_unchecked(&self) -> Result<Box<dyn Accountant>>;
    fn save_changes<T>(&self, accountant: Box<T>) -> Result<()>
        where T: Accountant + AnchorSerialize;
    
}

impl<'a> UncheckedAccountant for UncheckedAccount<'a> {
    fn get_discriminator(&self) -> Result<[u8; 8]> {
        let data = self.try_borrow_data()?;
        let discriminator = data[0..8].try_into().map_err(|_| ErrorCode::InvalidData)?;
        Ok(discriminator)
    }

    fn from_unchecked(&self) -> Result<Box<dyn Accountant>> {
        let data = self.try_borrow_data()?;
        let discriminator = data[0..8].try_into().map_err(|_| ErrorCode::InvalidData)?;

        match discriminator {
            GenericAccountant::DISCRIMINATOR => {
                let strategy = GenericAccountant::try_from_slice(&data[8..])
                    .map_err(|_| ErrorCode::InvalidData)?;
                Ok(Box::new(strategy))
            }
            _ => {
                msg!("Invalid discriminator");
                Err(ErrorCode::InvalidDiscriminator.into())
            }
        }
    }

    fn save_changes<T>(&self, accountant: Box<T>) -> Result<()>
        where T: Accountant + AnchorSerialize
    {
        let mut data = self.try_borrow_mut_data()?;
        accountant.serialize(&mut &mut data[8..])?;
        Ok(())
    }
    
}

// pub fn from_unchecked(strategy_acc: &UncheckedAccount) -> Result<Box<dyn Accountant>> {
//     let strategy_data = strategy_acc.try_borrow_data()?;
//     let discriminator = get_discriminator(strategy_acc)?;

//     match discriminator {
//         GenericAccountant::DISCRIMINATOR => {
//             let strategy = GenericAccountant::try_from_slice(&strategy_data[8..])
//                 .map_err(|_| ErrorCode::InvalidData)?;
//             Ok(Box::new(strategy))
//         }
//         _ => {
//             msg!("Invalid discriminator");
//             Err(ErrorCode::InvalidDiscriminator.into())
//         }
//     }
// }

// fn get_discriminator(acc_info: &UncheckedAccount) -> Result<[u8; 8]> {
//     let data = acc_info.try_borrow_data()?;
//     let discriminator = data[0..8].try_into().map_err(|_| ErrorCode::InvalidData)?;
//     Ok(discriminator)
// }