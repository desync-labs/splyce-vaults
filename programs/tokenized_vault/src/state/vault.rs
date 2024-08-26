use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use crate::constants::VAULT_SEED;
use crate::error::ErrorCode;

#[account]
// #[repr(packed)]
#[derive(Default, Debug)]
pub struct Vault {
    pub bump: [u8; 1],

    // /// Owner of the vault
    // pub owner: Pubkey,

    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    pub underlying_decimals: u8,

    pub total_debt: u64,
    pub total_shares: u64,

    pub deposit_limit: u64,
    pub min_user_deposit: u64,

    pub is_shutdown: bool,

    pub strategies: [Pubkey; 10],
}

impl Vault {
    pub fn seeds(&self) -> [&[u8]; 3] {
    [
        &VAULT_SEED.as_bytes(),
        self.underlying_mint.as_ref(),
        self.bump.as_ref(),
    ]}

    pub fn init(
        &mut self,
        bump: u8,
        underlying_mint: &InterfaceAccount<Mint>,
        underlying_token_acc: Pubkey,
        deposit_limit: u64,
        min_user_deposit: u64,
    ) -> Result<()> {
        self.bump = [bump];
        self.underlying_mint = underlying_mint.key();
        self.underlying_token_acc = underlying_token_acc;
        self.underlying_decimals = underlying_mint.decimals;
        self.deposit_limit = deposit_limit;
        self.min_user_deposit = min_user_deposit;
        self.is_shutdown = false;
        self.total_debt = 0;
        self.total_shares = 0;
        Ok(())
    }

    pub fn shutdown(&mut self) {
        self.is_shutdown = true;
    }

    pub fn handle_deposit(&mut self, amount: u64, shares: u64) {
        self.total_debt += amount;
        self.total_shares += shares;
    }

    pub fn handle_withdraw(&mut self, amount: u64, shares: u64) {
        self.total_debt -= amount;
        self.total_shares -= shares;
    }

    pub fn convert_to_shares(&self, amount: u64) -> u64 {
        if self.total_shares == 0 {
            amount
        } else {
            (amount as u128 * self.total_shares as u128 / self.total_debt as u128) as u64
        }
    }

    pub fn convert_to_underlying(&self, shares: u64) -> u64 {
        if self.total_shares == 0 {
            shares
        } else {
            (shares as u128 * self.total_debt as u128 / self.total_shares as u128) as u64
        }
    }

    pub fn add_strategy(&mut self, strategy: Pubkey) -> Result<()> {
        let strategies_count = self.strategies.iter().filter(|&x| x != &Pubkey::default()).count();
        if strategies_count == 10 {
            return Err(ErrorCode::StrategiesFull.into());
        }

        if self.strategies.contains(&strategy) {
            return Err(ErrorCode::StrategyAlreadyAdded.into());
        }

        self.strategies.iter().position(|&x| x == Pubkey::default()).map(|i| self.strategies[i] = strategy);
        Ok(())
    }

    pub fn remove_strategy(&mut self, strategy: Pubkey) -> Result<()> {
        if let Some(pos) = self.strategies.iter().position(|&x| x == strategy) {
            self.strategies[pos] = Pubkey::default();
            Ok(())
        } else {
            Err(ErrorCode::StrategyNotFound.into())
        }
    }

    pub fn is_vault_strategy(&self, strategy: Pubkey) -> bool {
        self.strategies.contains(&strategy)
    }
}