use anchor_lang::prelude::*;

#[derive(AnchorDeserialize, AnchorSerialize, Default, Debug, Clone)]
pub struct FeeData {
    pub fee_manager: Pubkey,  
    pub performance_fee: u64,
    pub fee_balance: u64,
}

impl FeeData {
    pub fn set_fee_manager(&mut self, fee_manager: Pubkey) -> Result<()> {
        self.fee_manager = fee_manager;
        Ok(())
    }

    pub fn set_performance_fee(&mut self, performance_fee: u64) -> Result<()> {
        self.performance_fee = performance_fee;
        Ok(())
    }

    pub fn fee_manager(&self) -> Pubkey {
        self.fee_manager
    }

    pub fn performance_fee(&self) -> u64 {
        self.performance_fee
    }

    pub fn fee_data(&self) -> u64 {
        self.fee_balance
    }
}