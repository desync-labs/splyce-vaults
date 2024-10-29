use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use anchor_spl::token_interface::Mint;

use crate::state::*;
use crate::constants::{ DISCRIMINATOR_LEN, FEE_BPS };
use crate::instructions::{Report, ReportProfit, ReportLoss, DeployFunds, FreeFunds};

pub trait StrategyDataAccount {
    fn save_changes(&self, writer: &mut dyn std::io::Write) -> Result<()>;
    fn seeds(&self) -> [&[u8]; 3];
    fn key(&self) -> Pubkey {
        let seeds = self.seeds();
        Pubkey::create_program_address(&seeds, &crate::id()).unwrap()
    }
}

pub trait StrategyInit {
    fn init(
        &mut self, 
        bump: u8,
        index: u8,
        vault: Pubkey, 
        underlying_mint: &InterfaceAccount<Mint>, 
        underlying_token_acc: Pubkey, 
        config_bytes: Vec<u8>
    ) -> Result<()>;
}

pub trait StrategyManagement {
    fn manager(&self) -> Pubkey;
    fn set_manager(&mut self, manager: Pubkey) -> Result<()>;
}

pub trait Strategy: StrategyDataAccount + StrategyInit + StrategyManagement {   
    // setters 
    fn deposit(&mut self, amount: u64) -> Result<()>;
    fn withdraw(&mut self, amount: u64) -> Result<()>;
    fn withdraw_fees(&mut self, amount: u64) -> Result<()>;
    fn harvest_and_report<'info>(&mut self, accounts: &Report<'info>, remaining: &[AccountInfo<'info>]) -> Result<u64>;
    fn deploy_funds<'info>(&mut self, accounts: &DeployFunds<'info>, remaining: &[AccountInfo<'info>], amount: u64) -> Result<()>;
    fn free_funds<'info>(&mut self, accounts: &FreeFunds<'info>, remaining: &[AccountInfo<'info>], amount: u64) -> Result<()>;
    fn set_total_assets(&mut self, total_assets: u64);

    fn report<'info>(&mut self, accounts: &Report<'info>, remaining: &[AccountInfo<'info>]) -> Result<()> {
        let old_total_assets = self.total_assets();
        let new_total_assets = self.harvest_and_report(accounts, remaining)?;

        if new_total_assets > old_total_assets {
            let profit = new_total_assets - old_total_assets;
            let fee_data = self.fee_data();

            if fee_data.performance_fee > 0 {
                let fees = (profit * fee_data.performance_fee) / FEE_BPS;
                fee_data.fee_balance += fees;
        
                self.set_total_assets(new_total_assets - fees);
            }
        } else {
            self.set_total_assets(new_total_assets);
        }

        Ok(())
    }

    fn report_profit<'info>(&mut self, accounts: &ReportProfit<'info>, remaining: &[AccountInfo<'info>], profit: u64) -> Result<()>;
    fn report_loss<'info>(&mut self, accounts: &ReportLoss<'info>, remaining: &[AccountInfo<'info>], loss: u64) -> Result<()>;

    // getters
    fn strategy_type(&self) -> StrategyType;
    fn vault(&self) -> Pubkey;
    /// Returns the total funds in the strategy, this value is affected by gains and losses
    fn total_assets(&self) -> u64;
    fn available_deposit(&self) -> u64;
    fn available_withdraw(&self) -> u64;
    fn token_account(&self) -> Pubkey;
    fn underlying_mint(&self) -> Pubkey;

    fn fee_data(&mut self) -> &mut FeeData;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum StrategyType {
    Simple,
    TradeFintech,
    RWA,
    Lending,
    Liquidation,
    Investor,
}

impl StrategyType {
    // TODO: Implement for other strategies
    pub fn from_discriminator(discriminator: &[u8]) -> Option<Self> {
        if discriminator == SimpleStrategy::discriminator() {
            Some(StrategyType::Simple)
        } else if discriminator == TradeFintechStrategy::discriminator() {
            Some(StrategyType::TradeFintech)
        } else {
            None
        }
    } 

    pub fn space(&self) -> usize {
        match self {
            StrategyType::Simple => DISCRIMINATOR_LEN + SimpleStrategy::INIT_SPACE,
            StrategyType::TradeFintech => DISCRIMINATOR_LEN + TradeFintechStrategy::INIT_SPACE,
            StrategyType::RWA => 0,
            StrategyType::Lending => 0,
            StrategyType::Liquidation => 0,
            StrategyType::Investor => 0,
        }
    }
}