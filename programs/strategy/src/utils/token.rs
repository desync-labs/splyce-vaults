use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

pub fn transfer_with_signer<'a>(
    token_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    amount: u64,
    seeds: &[&[u8]],
) -> Result<()> {
    token::transfer(
        CpiContext::new_with_signer(
            token_program,
            Transfer {
                from,
                to,
                authority,
            },
            &[&seeds]
        ),
        amount,
    )
}

pub fn transfer<'a>(
    token_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    amount: u64,
) -> Result<()> {   
    token::transfer(
        CpiContext::new(
            token_program,
            Transfer {
                from,
                to,
                authority,
            }
        ),
        amount,
    )
}

pub fn get_balance(token_account: &AccountInfo) -> Result<u64> {
    let amount = token::accessor::amount(token_account)?;
    Ok(amount)
}