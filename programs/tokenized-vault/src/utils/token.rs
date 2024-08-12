use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};

use crate::{vault, Vault};

// pub fn transfer_token_from(
//     token_program: AccountInfo,
//     from: AccountInfo,
//     to: AccountInfo,
//     authority: AccountInfo,
//     amount: u64,
// ) -> Result<()> {
//     let cpi_accounts = Transfer {
//         from: from,
//         to: to,
//         authority: authority,
//     };
//     let cpi_program = token_program;
//     let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
//     token::transfer(cpi_ctx, amount);
//     Ok(())
// }

// pub fn transfer_token_to(
//     token_program: AccountInfo,
//     from: AccountInfo,
//     to: AccountInfo,
//     authority: AccountInfo,
//     amount: u64,
// ) -> Result<()> {
//     let cpi_program = token_program;
//     token::transfer(CpiContext::new(cpi_program, Transfer {
//         from,
//         to,
//         authority,
//     }), amount);
//     Ok(())
// }

// pub fn mint_token_to<'info>(
//     vault_loader: AccountLoader<'info, Vault>,
//     token_program: AccountInfo,
//     mint: AccountInfo,
//     to: AccountInfo,
//     amount: u64,
// ) -> Result<()> {
//     let vault = vault_loader.load()?;
//     let shares = vault.convert_to_shares(amount);
//     let seeds = vault.seeds();
//     let cpi_accounts = MintTo {
//         mint,
//         to,
//         authority: vault_loader.to_account_info(),
//     };
    
//     let cpi_program = token_program;
//     let cpi_ctx = 
//     token::mint_to(
//         // CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), 
//         CpiContext::new_with_signer(cpi_program, cpi_accounts, &[&seeds]), 
//         shares
//     )?;
//     Ok(())
// }