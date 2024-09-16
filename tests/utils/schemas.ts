import { BN } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";


// Define the SimpleStrategy class
export class SimpleStrategy {
    depositLimit: BN;
    performanceFee: BN;
    feeManager: anchor.web3.PublicKey;

    constructor(fields: { depositLimit: BN, performanceFee: BN, feeManager: anchor.web3.PublicKey }) {
        this.depositLimit = fields.depositLimit;
        this.performanceFee = fields.performanceFee;
        this.feeManager = fields.feeManager;
    }
}

export class AccountsIndexes {
    strategy_acc: BN;
    strategy_token_account: BN;
    remaining_accounts_to_strategies: BN[];
  
    constructor(fields: { strategy_acc: BN, strategy_token_account: BN, remaining_accounts_to_strategies: BN[] }) {
      this.strategy_acc = fields.strategy_acc;
      this.strategy_token_account = fields.strategy_token_account;
      this.remaining_accounts_to_strategies = fields.remaining_accounts_to_strategies;
    }
  }
  
  export class AccountsMap {
    accounts_map: AccountsIndexes[];
  
    constructor(fields: { accounts_map: AccountsIndexes[] }) {
      this.accounts_map = fields.accounts_map;
    }
  }

// Define the schema for SimpleStrategy
export const SimpleStrategySchema = new Map([
    [
        SimpleStrategy,
        {
            kind: 'struct',
            fields: [
                ['depositLimit', 'u64'],
                ['performanceFee', 'u64'],
                ['feeManager', [32]],
            ],
        },
    ],
]);

export const AccountsMapSchema = new Map([
    [AccountsMap, {
      kind: 'struct',
      fields: [
        ['accounts_map', [AccountsIndexes]],
      ],
    }],
    [AccountsIndexes, {
      kind: 'struct',
      fields: [
        ['strategy_acc', 'u64'],
        ['strategy_token_account', 'u64'],
        ['remaining_accounts_to_strategies', ['u64']],
      ],
    }],
  ]);
  

/*
#[derive(Default, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AccountsIndexes {
    pub strategy_acc: u8,
    pub strategy_token_account: u8,
    pub remaining_accounts_to_strategies: Vec<u8>,
}

#[derive(Default, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AccountsMap {
    pub accounts_map: Vec<AccountsIndexes>,
}

*/
