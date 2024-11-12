use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use whirlpool_cpi::{self, state::*, util::unpack::unpack_tick_array, program::Whirlpool as WhirlpoolProgram};

pub fn orca_swap_handler<'a>(
    whirlpool_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    token_authority: &AccountInfo<'a>,
    whirlpool: &AccountInfo<'a>,
    token_owner_account_a: &AccountInfo<'a>,
    token_vault_a: &AccountInfo<'a>,
    token_owner_account_b: &AccountInfo<'a>,
    token_vault_b: &AccountInfo<'a>,
    tick_array_0: &AccountInfo<'a>,
    tick_array_1: &AccountInfo<'a>,
    tick_array_2: &AccountInfo<'a>,
    oracle: &AccountInfo<'a>,
    seeds: &[&[&[u8]]],  // For PDA signing
    amount: u64,
    other_amount_threshold: u64,
    sqrt_price_limit: u128,
    amount_specified_is_input: bool,
    a_to_b: bool,
) -> Result<()> {
    // Create the CPI accounts struct
    let cpi_accounts = whirlpool_cpi::cpi::accounts::Swap {
        whirlpool: whirlpool.clone(),
        token_program: token_program.clone(),
        token_authority: token_authority.clone(),
        token_owner_account_a: token_owner_account_a.clone(),
        token_vault_a: token_vault_a.clone(),
        token_owner_account_b: token_owner_account_b.clone(),
        token_vault_b: token_vault_b.clone(),
        tick_array_0: tick_array_0.clone(),
        tick_array_1: tick_array_1.clone(),
        tick_array_2: tick_array_2.clone(),
        oracle: oracle.clone(),
    };

    // Create CPI context with signer seeds if needed
    let cpi_ctx = CpiContext::new_with_signer(
        whirlpool_program.clone(),
        cpi_accounts,
        seeds,
    );

    // Execute the swap CPI
    msg!("CPI: whirlpool swap instruction");
    whirlpool_cpi::cpi::swap(
        cpi_ctx,
        amount,
        other_amount_threshold,
        sqrt_price_limit,
        amount_specified_is_input,
        a_to_b,
    )?;

    Ok(())
}
