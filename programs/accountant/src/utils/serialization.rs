use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::ErrorCode;

pub fn from_unchecked(strategy_acc: &UncheckedAccount) -> Result<Box<dyn Accountant>> {
    let strategy_data = strategy_acc.try_borrow_data()?;
    let discriminator = get_discriminator(strategy_acc)?;

    match AccountantType::from_discriminator(&discriminator) {
        Some(AccountantType::Generic) => {
            let strategy = GenericAccountant::try_from_slice(&strategy_data[8..])
                .map_err(|_| ErrorCode::InvalidData)?;
            Ok(Box::new(strategy))
        }
        _ => {
            msg!("Invalid discriminator");
            Err(ErrorCode::InvalidDiscriminator.into())
        }
    }
}

fn get_discriminator(acc_info: &UncheckedAccount) -> Result<[u8; 8]> {
    let data = acc_info.try_borrow_data()?;
    let discriminator = data[0..8].try_into().map_err(|_| ErrorCode::InvalidData)?;
    Ok(discriminator)
}