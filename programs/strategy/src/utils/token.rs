use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};


pub fn get_token_balance<'a>(
    token_program: AccountInfo<'a>,
    account: AccountInfo<'a>,
) -> Result<u64> {
    let account_data = account.try_borrow_data()?;
    let token_account = TokenAccount::try_deserialize(&mut &account_data[..])?;
    Ok(token_account.amount)
}

pub fn transfer_token_from<'a>(
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

pub fn transfer_token_to<'a>(
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