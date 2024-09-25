// #[derive(Accounts)]
// pub struct InitializeVault<'info> {
//     #[account(
//         init, 
//         seeds = [b"vault"], 
//         bump,  
//         payer = admin, 
//         space = 8 + 8 + 8)]
//     pub vault: Account<'info, Vault>,
//     #[account(
//         init, 
//         seeds = [b"shares"], 
//         bump, 
//         payer = admin, 
//         mint::decimals = 18, 
//         mint::authority = mint,
//     )]
//     pub mint: Account<'info, Mint>,
//     #[account(mut)]
//     pub admin: Signer<'info>,
//     pub token_program: Program<'info, Token>,
//     pub system_program: Program<'info, System>,
//     pub rent: Sysvar<'info, Rent>,
// }


// #[derive(Accounts)]
// pub struct InitializeVaultTokenAccount<'info> {
//     #[account(
//         init, 
//         seeds = [b"tokens"], 
//         bump, 
//         payer = admin, 
//         token::mint = underlying_mint,
//         token::authority = token_account,
//     )]
//     pub token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub underlying_mint: Account<'info, Mint>,
//     #[account(mut)]
//     pub admin: Signer<'info>,
//     pub token_program: Program<'info, Token>,
//     pub system_program: Program<'info, System>,
//     pub rent: Sysvar<'info, Rent>,
// }

// #[derive(Accounts)]
// pub struct Deposit<'info> {
//     #[account(mut)]
//     pub vault: Account<'info, Vault>,
//     #[account(mut)]
//     pub user: Signer<'info>,
//     #[account(mut)]
//     pub user_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub vault_token_account: Account<'info, TokenAccount>,
//     #[account(mut, seeds = [b"shares"], bump)]
//     pub shares_mint: Account<'info, Mint>,
//     #[account(mut)]
//     pub user_shares_account: Account<'info, TokenAccount>,
//     pub token_program: Program<'info, Token>,
// }

// #[derive(Accounts)]
// pub struct Withdraw<'info> {
//     #[account(mut)]
//     pub vault: Account<'info, Vault>,
//     #[account(mut)]
//     pub user: Signer<'info>,
//     #[account(mut)]
//     pub user_token_account: Account<'info, TokenAccount>,
//     #[account(mut, seeds = [b"tokens"], bump)]
//     pub vault_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub shares_mint: Account<'info, Mint>,
//     #[account(mut)]
//     pub user_shares_account: Account<'info, TokenAccount>,
//     pub token_program: Program<'info, Token>,
// }
