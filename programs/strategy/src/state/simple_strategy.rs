use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use std::convert::TryFrom;
use borsh::BorshDeserialize;
use std::result::Result as StdResult;

use crate::constants::STRATEGY_SEED;
use crate::base_strategy::Strategy;

#[account()]
#[derive(Default, Debug)]
pub struct SimpleStrategy {
    /// Bump to identify PDA
    pub bump: [u8; 1],

    /// vault
    pub vault: Pubkey,
    pub underlying_mint: Pubkey,
    pub underlying_token_acc: Pubkey,
    // this value mast be u64 because of the borsh serialization
    pub undelying_decimals: u8,
    pub total_funds: u64,
    pub deposit_limit: u64,
}

impl Strategy for SimpleStrategy {
    fn available_deposit(&self) -> Result<u64> {
        Ok(self.deposit_limit - self.total_funds)
    }

    fn available_withdraw(&self) -> Result<u64> {
        Ok(self.deposit_limit)
    }

    fn deposit(&mut self, amount: u64) -> Result<()> {
        self.total_funds += amount;
        Ok(())
    }

    fn withdraw(&mut self, amount: u64) -> Result<()> {
        self.total_funds -= amount;
        Ok(())
    }

    fn harvest(&mut self) -> Result<()> {
        // todo: implement harvest
        Ok(())
    }
}


impl SimpleStrategy {
    pub const LEN: usize = 8
        + 1
        + 32
        + 32
        + 32
        + 1
        + 8
        + 8;

    pub fn init(
        &mut self,
        bump: u8,
        vault: Pubkey, 
        deposit_limit: u64,
        underlying_mint: &InterfaceAccount<Mint>, 
        underlying_token_acc: Pubkey, 
    ) -> Result<()> {
        self.bump = [bump]; 
        self.vault = vault;
        self.underlying_mint = underlying_mint.key();
        self.undelying_decimals = underlying_mint.decimals;
        self.underlying_token_acc = underlying_token_acc;
        self.deposit_limit = deposit_limit;
        self.total_funds = 0;

        Ok(())
    }

     pub fn seeds(&self) -> [&[u8]; 2] {
        [
            &STRATEGY_SEED.as_bytes(),
            self.bump.as_ref(),
        ]
    }

    // fn key(&self) -> Pubkey {
    //     let seeds = [
    //             &STRATEGY_SEED.as_bytes(),
    //             // self.vault.as_ref(),
    //             // self.bump.as_ref(),
    //         ];
    //     Pubkey::create_program_address(&seeds, &crate::id()).unwrap()
    // }

    fn owner(&self) -> Pubkey {
        // self.vault
        Pubkey::default()
    }

   

    // fn deploy_funds(&mut self, amount: u64) -> Result<()> {
    //     self.total_idle -= amount;
    //     Ok(())
    // }
}
