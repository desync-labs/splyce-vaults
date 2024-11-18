import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { assert, expect } from "chai";
import { SimpleStrategyConfig } from "../../../utils/schemas";
import {
  airdrop,
  initializeSimpleStrategy,
  initializeVault,
} from "../../../utils/helpers";
import {
  vaultProgram,
  strategyProgram,
  rolesAdmin,
  connection,
} from "../../setups/globalSetup";

interface User {
  keypair: anchor.web3.Keypair;
  tokenAccount: anchor.web3.PublicKey;
  vaultOneSharesAccount: anchor.web3.PublicKey;
  vaultTwoSharesAccount: anchor.web3.PublicKey;
  vaultThreeSharesAccount: anchor.web3.PublicKey;
  underlyingTokenCurrentBalance: number;
  vaultOneSharesCurrentBalance: number;
  vaultTwoSharesCurrentBalance: number;
}

interface Vault {
  vault: anchor.web3.PublicKey;
  sharesMintAccount: anchor.web3.PublicKey;
  metadataAccount: anchor.web3.PublicKey;
  tokenAccount: anchor.web3.PublicKey;
  currentTokenBalance: number;
}

describe("Standard Vault: Withdrawal Tests", () => {
  let vaultsAndReportingAdmin: anchor.web3.Keypair;
  let underlyingMint: anchor.web3.PublicKey;
  let underlyingMintOwner: anchor.web3.Keypair;
  let vaultConfig: any;
  let strategyConfig: SimpleStrategyConfig;
  const vaultsAdminObj = { vaultsAdmin: {} };
  const reportingManagerObj = { reportingManager: {} };

  let userOne: User = {
    keypair: null,
    tokenAccount: null,
    vaultOneSharesAccount: null,
    vaultTwoSharesAccount: null,
    vaultThreeSharesAccount: null,
    underlyingTokenCurrentBalance: 0,
    vaultOneSharesCurrentBalance: 0,
    vaultTwoSharesCurrentBalance: 0,
  };

  let userTwo: User = {
    keypair: null,
    tokenAccount: null,
    vaultOneSharesAccount: null,
    vaultTwoSharesAccount: null,
    vaultThreeSharesAccount: null,
    underlyingTokenCurrentBalance: 0,
    vaultOneSharesCurrentBalance: 0,
    vaultTwoSharesCurrentBalance: 0,
  };

  let vaultOne: Vault = {
    vault: null,
    sharesMintAccount: null,
    metadataAccount: null,
    tokenAccount: null,
    currentTokenBalance: 0,
  };

  let vaultTwo: Vault = {
    vault: null,
    sharesMintAccount: null,
    metadataAccount: null,
    tokenAccount: null,
    currentTokenBalance: 0,
  };

  let vaultThree: Vault = {
    vault: null,
    sharesMintAccount: null,
    metadataAccount: null,
    tokenAccount: null,
    currentTokenBalance: 0,
  };

  let strategyOne: anchor.web3.PublicKey;
  let strategyTokenAccountOne: anchor.web3.PublicKey;
  let strategyTwo: anchor.web3.PublicKey;
  let strategyTokenAccountTwo: anchor.web3.PublicKey;
  let strategyThree: anchor.web3.PublicKey;
  let strategyTokenAccountThree: anchor.web3.PublicKey;

  before(async () => {
    console.log("-------Before Step Started-------");
    vaultsAndReportingAdmin = anchor.web3.Keypair.generate();
    userOne.keypair = anchor.web3.Keypair.generate();
    userTwo.keypair = anchor.web3.Keypair.generate();
    underlyingMintOwner = rolesAdmin;

    console.log("Vault Program ID:", vaultProgram.programId.toBase58());
    console.log("Strategy Program ID:", strategyProgram.programId.toBase58());
    console.log(
      "Underlying Mint Token Owner key: ",
      underlyingMintOwner.publicKey.toBase58()
    );
    console.log(
      "Vaults and Reporting Admin public key:",
      vaultsAndReportingAdmin.publicKey.toBase58()
    );
    console.log("User One public key:", userOne.keypair.publicKey.toBase58());
    console.log("User Two public key:", userOne.keypair.publicKey.toBase58());

    // Airdrop to all accounts
    const publicKeysList = [
      vaultsAndReportingAdmin.publicKey,
      userOne.keypair.publicKey,
      userTwo.keypair.publicKey,
    ];
    for (const publicKey of publicKeysList) {
      await airdrop({
        connection,
        publicKey,
        amount: 100e9,
      });
    }

    // Set Roles for the common accounts
    await vaultProgram.methods
      .setRole(vaultsAdminObj, vaultsAndReportingAdmin.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();

    await vaultProgram.methods
      .setRole(reportingManagerObj, vaultsAndReportingAdmin.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();

    console.log("All roles set successfully");

    // Create common underlying mint account
    underlyingMint = await token.createMint(
      connection,
      underlyingMintOwner,
      underlyingMintOwner.publicKey,
      null,
      9
    );

    console.log("Underlying mint created successfully");

    // Initialize vaults and strategies
    vaultConfig = {
      name: "Standard Vault Deposit Tests",
      symbol: "SVT1",
      uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
      depositLimit: new BN(5000000000000),
      minUserDeposit: new BN(1000000000),
      performanceFee: new BN(1000),
      profitMaxUnlockTime: new BN(0),
    };

    strategyConfig = new SimpleStrategyConfig({
      depositLimit: new BN(1000000000000),
      performanceFee: new BN(1),
      // @ts-ignore
      feeManager: vaultsAndReportingAdmin.publicKey,
    });

    [
      vaultOne.vault,
      vaultOne.sharesMintAccount,
      vaultOne.metadataAccount,
      vaultOne.tokenAccount,
    ] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 21,
      signer: vaultsAndReportingAdmin,
      config: vaultConfig,
    });

    [
      vaultTwo.vault,
      vaultTwo.sharesMintAccount,
      vaultTwo.metadataAccount,
      vaultTwo.tokenAccount,
    ] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 22,
      signer: vaultsAndReportingAdmin,
      config: vaultConfig,
    });

    [
      vaultThree.vault,
      vaultThree.sharesMintAccount,
      vaultThree.metadataAccount,
      vaultThree.tokenAccount,
    ] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 23,
      signer: vaultsAndReportingAdmin,
      config: vaultConfig,
    });

    console.log("All Vaults initialized successfully");

    [strategyOne, strategyTokenAccountOne] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultOne.vault,
      underlyingMint,
      signer: vaultsAndReportingAdmin,
      index: 1,
      config: strategyConfig,
    });

    [strategyTwo, strategyTokenAccountTwo] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultTwo.vault,
      underlyingMint,
      signer: vaultsAndReportingAdmin,
      index: 1,
      config: strategyConfig,
    });

    [strategyThree, strategyTokenAccountThree] = await initializeSimpleStrategy(
      {
        strategyProgram,
        vault: vaultTwo.vault,
        underlyingMint,
        signer: vaultsAndReportingAdmin,
        index: 2,
        config: strategyConfig,
      }
    );

    console.log("All Strategies initialized successfully");

    await vaultProgram.methods
      .addStrategy(new BN(1000000000000))
      .accounts({
        vault: vaultOne.vault,
        strategy: strategyOne,
        signer: vaultsAndReportingAdmin.publicKey,
      })
      .signers([vaultsAndReportingAdmin])
      .rpc();

    await vaultProgram.methods
      .addStrategy(new BN(1000000000000))
      .accounts({
        vault: vaultTwo.vault,
        strategy: strategyTwo,
        signer: vaultsAndReportingAdmin.publicKey,
      })
      .signers([vaultsAndReportingAdmin])
      .rpc();

    await vaultProgram.methods
      .addStrategy(new BN(1000000000000))
      .accounts({
        vault: vaultTwo.vault,
        strategy: strategyThree,
        signer: vaultsAndReportingAdmin.publicKey,
      })
      .signers([vaultsAndReportingAdmin])
      .rpc();

    console.log("All Strategies added to corresponding vaults successfully");

    userOne.tokenAccount = await token.createAccount(
      connection,
      userOne.keypair,
      underlyingMint,
      userOne.keypair.publicKey
    );
    userTwo.tokenAccount = await token.createAccount(
      connection,
      userTwo.keypair,
      underlyingMint,
      userTwo.keypair.publicKey
    );
    console.log("User token accounts created successfully");

    const mintAmount = 10000000000000;
    await token.mintTo(
      connection,
      underlyingMintOwner,
      underlyingMint,
      userOne.tokenAccount,
      underlyingMintOwner.publicKey,
      mintAmount
    );
    await token.mintTo(
      connection,
      underlyingMintOwner,
      underlyingMint,
      userTwo.tokenAccount,
      underlyingMintOwner.publicKey,
      mintAmount
    );

    userOne.underlyingTokenCurrentBalance = mintAmount;
    userTwo.underlyingTokenCurrentBalance = mintAmount;

    console.log("Minted 1000000000000 underlying tokens to users successfully");

    userOne.vaultOneSharesAccount = await token.createAccount(
      connection,
      userOne.keypair,
      vaultOne.sharesMintAccount,
      userOne.keypair.publicKey
    );
    userOne.vaultTwoSharesAccount = await token.createAccount(
      connection,
      userOne.keypair,
      vaultTwo.sharesMintAccount,
      userOne.keypair.publicKey
    );
    userOne.vaultThreeSharesAccount = await token.createAccount(
      connection,
      userOne.keypair,
      vaultThree.sharesMintAccount,
      userOne.keypair.publicKey
    );

    userTwo.vaultOneSharesAccount = await token.createAccount(
      connection,
      userTwo.keypair,
      vaultOne.sharesMintAccount,
      userTwo.keypair.publicKey
    );
    userTwo.vaultTwoSharesAccount = await token.createAccount(
      connection,
      userTwo.keypair,
      vaultTwo.sharesMintAccount,
      userTwo.keypair.publicKey
    );

    console.log(
      "Created all required shares accounts for all users successfully"
    );
    console.log("-------Before Step Finished-------");
  });

  it("Withdrawing partially from a single strategy vault with non-allocated funds is successful", async function () {
    // this.qaseId(69);
    const depositAmount = 100000000000;

    await vaultProgram.methods
      .deposit(new BN(depositAmount))
      .accounts({
        vault: vaultOne.vault,
        user: userOne.keypair.publicKey,
        userTokenAccount: userOne.tokenAccount,
        userSharesAccount: userOne.vaultOneSharesAccount,
      })
      .signers([userOne.keypair])
      .rpc();

    userOne.underlyingTokenCurrentBalance -= depositAmount;
    userOne.vaultOneSharesCurrentBalance += depositAmount;
    vaultOne.currentTokenBalance += depositAmount;

    const remainingAccountsMap = {
      accountsMap: [
        {
          strategyAcc: new BN(0),
          strategyTokenAccount: new BN(1),
          remainingAccountsToStrategies: [new BN(0)],
        },
      ],
    };

    const withdrawalAmount = 50000000000;

    await vaultProgram.methods
      .withdraw(
        new BN(withdrawalAmount),
        new BN(100000000000),
        remainingAccountsMap
      )
      .accounts({
        vault: vaultOne.vault,
        user: userOne.keypair.publicKey,
        userTokenAccount: userOne.tokenAccount,
        userSharesAccount: userOne.vaultOneSharesAccount,
      })
      .remainingAccounts([
        { pubkey: strategyOne, isWritable: true, isSigner: false },
        { pubkey: strategyTokenAccountOne, isWritable: true, isSigner: false },
      ])
      .signers([userOne.keypair])
      .rpc();

    userOne.underlyingTokenCurrentBalance += withdrawalAmount;
    userOne.vaultOneSharesCurrentBalance -= withdrawalAmount;
    vaultOne.currentTokenBalance -= withdrawalAmount;

    const vaultAccount = await vaultProgram.account.vault.fetch(vaultOne.vault);
    assert.strictEqual(
      vaultAccount.totalIdle.toString(),
      vaultOne.currentTokenBalance.toString()
    );

    let vaultTokenAccountInfo = await token.getAccount(
      connection,
      vaultOne.tokenAccount
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultOne.currentTokenBalance.toString()
    );

    let userSharesAccountInfo = await token.getAccount(
      connection,
      userOne.vaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      userOne.vaultOneSharesCurrentBalance.toString()
    );

    let userTokenAccountInfo = await token.getAccount(
      connection,
      userOne.tokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOne.underlyingTokenCurrentBalance.toString()
    );
  });

  it("Withdrawing fully from a single strategy vault with non-allocated funds is successful", async function () {
    // this.qaseId(70);
    const depositAmount = 100000000000;

    await vaultProgram.methods
      .deposit(new BN(depositAmount))
      .accounts({
        vault: vaultOne.vault,
        user: userOne.keypair.publicKey,
        userTokenAccount: userOne.tokenAccount,
        userSharesAccount: userOne.vaultOneSharesAccount,
      })
      .signers([userOne.keypair])
      .rpc();

    userOne.underlyingTokenCurrentBalance -= depositAmount;
    userOne.vaultOneSharesCurrentBalance += depositAmount;
    vaultOne.currentTokenBalance += depositAmount;

    const remainingAccountsMap = {
      accountsMap: [
        {
          strategyAcc: new BN(0),
          strategyTokenAccount: new BN(1),
          remainingAccountsToStrategies: [new BN(0)],
        },
      ],
    };

    const withdrawalAmount = userOne.vaultOneSharesCurrentBalance;

    await vaultProgram.methods
      .withdraw(
        new BN(withdrawalAmount),
        new BN(100000000000),
        remainingAccountsMap
      )
      .accounts({
        vault: vaultOne.vault,
        user: userOne.keypair.publicKey,
        userTokenAccount: userOne.tokenAccount,
        userSharesAccount: userOne.vaultOneSharesAccount,
      })
      .remainingAccounts([
        { pubkey: strategyOne, isWritable: true, isSigner: false },
        { pubkey: strategyTokenAccountOne, isWritable: true, isSigner: false },
      ])
      .signers([userOne.keypair])
      .rpc();

    userOne.underlyingTokenCurrentBalance += withdrawalAmount;
    userOne.vaultOneSharesCurrentBalance -= withdrawalAmount;
    vaultOne.currentTokenBalance -= withdrawalAmount;

    const vaultAccount = await vaultProgram.account.vault.fetch(vaultOne.vault);
    assert.strictEqual(
      vaultAccount.totalIdle.toString(),
      vaultOne.currentTokenBalance.toString()
    );

    let vaultTokenAccountInfo = await token.getAccount(
      connection,
      vaultOne.tokenAccount
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultOne.currentTokenBalance.toString()
    );

    let userSharesAccountInfo = await token.getAccount(
      connection,
      userOne.vaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      userOne.vaultOneSharesCurrentBalance.toString()
    );

    let userTokenAccountInfo = await token.getAccount(
      connection,
      userOne.tokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOne.underlyingTokenCurrentBalance.toString()
    );
  });

  it("Withdrawing partially from a multi strategy vault with non-allocated funds is successful", async function () {
    // this.qaseId(71);
    // TO DO
  });

  it("Withdrawing fully from a multi strategy vault with non-allocated funds is successful", async function () {
    // this.qaseId(72);
    // TO DO
  });

  it("Withdrawing partially from a single strategy vault with fully allocated funds is successful", async function () {
    // this.qaseId(73);
    // TO DO
  });

  it("Withdrawing fully from a single strategy vault with fully allocated funds is successful", async function () {
    // this.qaseId(74);
    // TO DO
  });

  it("Withdrawing partially from a multi strategy vault with fully allocated funds to both strategies is successful", async function () {
    // this.qaseId(75);
    // TO DO
  });

  it("Withdrawing fully from a multi strategy vault with fully allocated funds to both strategies is successful", async function () {
    // this.qaseId(76);
    // TO DO
  });

  it("Withdrawing transferred shares from vault is successful", async function () {
    // this.qaseId(77);
    // TO DO
  });

  it("Withdrawing more than deposited balance in the vault should revert", async function () {
    // this.qaseId(78);
    // TO DO
  });

  it("Withdrawing from a shut down vault should revert", async function () {
    // this.qaseId(79);
    // TO DO
  });

  // TO DO: Add max loss related test(s)
});
