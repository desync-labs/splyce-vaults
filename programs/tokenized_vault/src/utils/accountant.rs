use anchor_lang::prelude::*;
// use anchor_spl::token::TokenAccount;
 
use accountant::utils::from_unchecked;

// use crate::error::ErrorCode::*;

pub fn report(acccountant: &UncheckedAccount, profit: u64, loss: u64) -> Result<(u64,u64)>{
    let acc = from_unchecked(acccountant)?;
    acc.report(
        profit, 
        loss
    )
}

pub fn performance_fee(acccountant: &UncheckedAccount) -> Result<u64>{
    let acc = from_unchecked(acccountant)?;
    Ok(acc.performance_fee())
}