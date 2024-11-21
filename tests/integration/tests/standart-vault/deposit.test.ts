/*
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

describe("Standard Vault: Deposit Tests", () => {
  let vaultsAndReportingAdmin: anchor.web3.Keypair;
  let userOne: anchor.web3.Keypair;
  let userOneTokenAccount: anchor.web3.PublicKey;
  let userOneVaultOneSharesAccount: anchor.web3.PublicKey;
  let userOneVaultTwoSharesAccount: anchor.web3.PublicKey;
  let userOneVaultThreeSharesAccount: anchor.web3.PublicKey;
  let userTwo: anchor.web3.Keypair;
  let userTwoTokenAccount: anchor.web3.PublicKey;
  let userTwoVaultOneSharesAccount: anchor.web3.PublicKey;
  let userTwoVaultTwoSharesAccount: anchor.web3.PublicKey;
  let underlyingMint: anchor.web3.PublicKey;
  let underlyingMintOwner: anchor.web3.Keypair;

  // First - For Role Admin
  let vaultOne: anchor.web3.PublicKey;
  let vaultTwo: anchor.web3.PublicKey;
  let vaultThree: anchor.web3.PublicKey;
  let sharesMintOne: anchor.web3.PublicKey;
  let sharesMintTwo: anchor.web3.PublicKey;
  let sharesMintThree: anchor.web3.PublicKey;
  let metadataAccountOne: anchor.web3.PublicKey;
  let metadataAccountTwo: anchor.web3.PublicKey;
  let metadataAccountThree: anchor.web3.PublicKey;
  let vaultTokenAccountOne: anchor.web3.PublicKey;
  let vaultTokenAccountTwo: anchor.web3.PublicKey;
  let vaultTokenAccountThree: anchor.web3.PublicKey;
  let strategyOne: anchor.web3.PublicKey;
  let strategyTokenAccountOne: anchor.web3.PublicKey;
  let strategyTwo: anchor.web3.PublicKey;
  let strategyTokenAccountTwo: anchor.web3.PublicKey;
  let strategyThree: anchor.web3.PublicKey;
  let strategyTokenAccountThree: anchor.web3.PublicKey;

  let userOneUnderlyingTokenCurrentBalance: number = 0;
  let userOneVaultOneSharesCurrentBalance: number = 0;
  let userOneVaultTwoSharesCurrentBalance: number = 0;
  let userTwoUnderlyingTokenCurrentBalance: number = 0;
  let userTwoVaultOneSharesCurrentBalance: number = 0;
  let userTwoVaultTwoSharesCurrentBalance: number = 0;
  let vaultOneCurrentTokenBalance: number = 0;
  let vaultTwoCurrentTokenBalance: number = 0;

  const vaultsAdminObj = { vaultsAdmin: {} };
  const reportingManagerObj = { reportingManager: {} };

  let vaultConfig: any;
  let strategyConfig: SimpleStrategyConfig;

  before(async () => {
    console.log("-------Before Step Started-------");
    vaultsAndReportingAdmin = anchor.web3.Keypair.generate();
    userOne = anchor.web3.Keypair.generate();
    userTwo = anchor.web3.Keypair.generate();
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
    console.log("User One public key:", userOne.publicKey.toBase58());

    // Airdrop to all accounts
    const publicKeysList = [
      vaultsAndReportingAdmin.publicKey,
      userOne.publicKey,
      userTwo.publicKey,
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

    [vaultOne, sharesMintOne, metadataAccountOne, vaultTokenAccountOne] =
      await initializeVault({
        vaultProgram,
        underlyingMint,
        vaultIndex: 11,
        signer: vaultsAndReportingAdmin,
        config: vaultConfig,
      });

    [vaultTwo, sharesMintTwo, metadataAccountTwo, vaultTokenAccountTwo] =
      await initializeVault({
        vaultProgram,
        underlyingMint,
        vaultIndex: 12,
        signer: vaultsAndReportingAdmin,
        config: vaultConfig,
      });

    [
      vaultThree,
      sharesMintThree,
      metadataAccountThree,
      vaultTokenAccountThree,
    ] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 13,
      signer: vaultsAndReportingAdmin,
      config: vaultConfig,
    });

    await vaultProgram.methods
      .shutdownVault()
      .accounts({
        vault: vaultThree,
        signer: vaultsAndReportingAdmin.publicKey,
      })
      .signers([vaultsAndReportingAdmin])
      .rpc();

    console.log("All Vaults initialized successfully");

    [strategyOne, strategyTokenAccountOne] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultOne,
      underlyingMint,
      signer: vaultsAndReportingAdmin,
      index: 1,
      config: strategyConfig,
    });

    [strategyTwo, strategyTokenAccountTwo] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultTwo,
      underlyingMint,
      signer: vaultsAndReportingAdmin,
      index: 1,
      config: strategyConfig,
    });

    [strategyThree, strategyTokenAccountThree] = await initializeSimpleStrategy(
      {
        strategyProgram,
        vault: vaultTwo,
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
        vault: vaultOne,
        strategy: strategyOne,
        signer: vaultsAndReportingAdmin.publicKey,
      })
      .signers([vaultsAndReportingAdmin])
      .rpc();

    await vaultProgram.methods
      .addStrategy(new BN(1000000000000))
      .accounts({
        vault: vaultTwo,
        strategy: strategyTwo,
        signer: vaultsAndReportingAdmin.publicKey,
      })
      .signers([vaultsAndReportingAdmin])
      .rpc();

    await vaultProgram.methods
      .addStrategy(new BN(1000000000000))
      .accounts({
        vault: vaultTwo,
        strategy: strategyThree,
        signer: vaultsAndReportingAdmin.publicKey,
      })
      .signers([vaultsAndReportingAdmin])
      .rpc();

    console.log("All Strategies added to corresponding vaults successfully");

    userOneTokenAccount = await token.createAccount(
      connection,
      userOne,
      underlyingMint,
      userOne.publicKey
    );
    userTwoTokenAccount = await token.createAccount(
      connection,
      userTwo,
      underlyingMint,
      userTwo.publicKey
    );
    console.log("User token accounts created successfully");

    const mintAmount = 10000000000000;
    await token.mintTo(
      connection,
      underlyingMintOwner,
      underlyingMint,
      userOneTokenAccount,
      underlyingMintOwner.publicKey,
      mintAmount
    );
    await token.mintTo(
      connection,
      underlyingMintOwner,
      underlyingMint,
      userTwoTokenAccount,
      underlyingMintOwner.publicKey,
      mintAmount
    );
    userOneUnderlyingTokenCurrentBalance = mintAmount;
    userTwoUnderlyingTokenCurrentBalance = mintAmount;

    console.log("Minted 1000000000000 underlying tokens to users successfully");

    userOneVaultOneSharesAccount = await token.createAccount(
      connection,
      userOne,
      sharesMintOne,
      userOne.publicKey
    );
    userOneVaultTwoSharesAccount = await token.createAccount(
      connection,
      userOne,
      sharesMintTwo,
      userOne.publicKey
    );
    userOneVaultThreeSharesAccount = await token.createAccount(
      connection,
      userOne,
      sharesMintThree,
      userOne.publicKey
    );
    userTwoVaultOneSharesAccount = await token.createAccount(
      connection,
      userTwo,
      sharesMintOne,
      userTwo.publicKey
    );
    userTwoVaultTwoSharesAccount = await token.createAccount(
      connection,
      userTwo,
      sharesMintTwo,
      userTwo.publicKey
    );
    console.log(
      "Created all required shares accounts for all users successfully"
    );
    console.log("-------Before Step Finished-------");
  });

  it("Depositing first time into a single strategy vault is successful", async function () {
    this.qaseId(59);
    const depositAmount = 100000000000;

    await vaultProgram.methods
      .deposit(new BN(depositAmount))
      .accounts({
        vault: vaultOne,
        user: userOne.publicKey,
        userTokenAccount: userOneTokenAccount,
        userSharesAccount: userOneVaultOneSharesAccount,
      })
      .signers([userOne])
      .rpc();

    userOneUnderlyingTokenCurrentBalance -= depositAmount;
    userOneVaultOneSharesCurrentBalance += depositAmount;
    vaultOneCurrentTokenBalance += depositAmount;

    const vaultTokenAccountInfo = await token.getAccount(
      connection,
      vaultTokenAccountOne
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultOneCurrentTokenBalance.toString()
    );

    const userSharesAccountInfo = await token.getAccount(
      connection,
      userOneVaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      userOneVaultOneSharesCurrentBalance.toString()
    );

    const userTokenAccountInfo = await token.getAccount(
      connection,
      userOneTokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOneUnderlyingTokenCurrentBalance.toString()
    );
  });

  it("Topping up in a single strategy vault is successful", async function () {
    this.qaseId(60);
    const depositAmount = 50000000000;
    const topUpAmount = 1050000000;
    const totalDepositAmount = depositAmount + topUpAmount;

    await vaultProgram.methods
      .deposit(new BN(depositAmount))
      .accounts({
        vault: vaultOne,
        user: userOne.publicKey,
        userTokenAccount: userOneTokenAccount,
        userSharesAccount: userOneVaultOneSharesAccount,
      })
      .signers([userOne])
      .rpc();

    await vaultProgram.methods
      .deposit(new BN(topUpAmount))
      .accounts({
        vault: vaultOne,
        user: userOne.publicKey,
        userTokenAccount: userOneTokenAccount,
        userSharesAccount: userOneVaultOneSharesAccount,
      })
      .signers([userOne])
      .rpc();

    userOneUnderlyingTokenCurrentBalance -= totalDepositAmount;
    userOneVaultOneSharesCurrentBalance += totalDepositAmount;
    vaultOneCurrentTokenBalance += totalDepositAmount;

    const vaultTokenAccountInfo = await token.getAccount(
      connection,
      vaultTokenAccountOne
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultOneCurrentTokenBalance.toString()
    );

    const userSharesAccountInfo = await token.getAccount(
      connection,
      userOneVaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      userOneVaultOneSharesCurrentBalance.toString()
    );

    const userTokenAccountInfo = await token.getAccount(
      connection,
      userOneTokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOneUnderlyingTokenCurrentBalance.toString()
    );
  });

  it("Depositing first time into a multi strategy vault is successful", async function () {
    this.qaseId(61);
    const depositAmount = 100000000000;

    await vaultProgram.methods
      .deposit(new BN(depositAmount))
      .accounts({
        vault: vaultTwo,
        user: userOne.publicKey,
        userTokenAccount: userOneTokenAccount,
        userSharesAccount: userOneVaultTwoSharesAccount,
      })
      .signers([userOne])
      .rpc();

    userOneUnderlyingTokenCurrentBalance -= depositAmount;
    userOneVaultTwoSharesCurrentBalance += depositAmount;
    vaultTwoCurrentTokenBalance += depositAmount;

    const vaultTokenAccountInfo = await token.getAccount(
      connection,
      vaultTokenAccountTwo
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultTwoCurrentTokenBalance.toString()
    );

    const userSharesAccountInfo = await token.getAccount(
      connection,
      userOneVaultTwoSharesAccount
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      userOneVaultTwoSharesCurrentBalance.toString()
    );

    const userTokenAccountInfo = await token.getAccount(
      connection,
      userOneTokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOneUnderlyingTokenCurrentBalance.toString()
    );
  });

  it("Topping up in a multi strategy vault is successful", async function () {
    this.qaseId(62);
    const depositAmount = 40000000000;
    const topUpAmount = 1060000000;
    const totalDepositAmount = depositAmount + topUpAmount;

    await vaultProgram.methods
      .deposit(new BN(depositAmount))
      .accounts({
        vault: vaultTwo,
        user: userOne.publicKey,
        userTokenAccount: userOneTokenAccount,
        userSharesAccount: userOneVaultTwoSharesAccount,
      })
      .signers([userOne])
      .rpc();

    await vaultProgram.methods
      .deposit(new BN(topUpAmount))
      .accounts({
        vault: vaultTwo,
        user: userOne.publicKey,
        userTokenAccount: userOneTokenAccount,
        userSharesAccount: userOneVaultTwoSharesAccount,
      })
      .signers([userOne])
      .rpc();

    userOneUnderlyingTokenCurrentBalance -= totalDepositAmount;
    userOneVaultTwoSharesCurrentBalance += totalDepositAmount;
    vaultTwoCurrentTokenBalance += totalDepositAmount;

    const vaultTokenAccountInfo = await token.getAccount(
      connection,
      vaultTokenAccountTwo
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultTwoCurrentTokenBalance.toString()
    );

    const userSharesAccountInfo = await token.getAccount(
      connection,
      userOneVaultTwoSharesAccount
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      userOneVaultTwoSharesCurrentBalance.toString()
    );

    const userTokenAccountInfo = await token.getAccount(
      connection,
      userOneTokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOneUnderlyingTokenCurrentBalance.toString()
    );
  });

  it("Depositing less then minimum deposit amount should revert", async function () {
    this.qaseId(63);
    const depositAmount = 999999999;

    try {
      await vaultProgram.methods
        .deposit(new BN(depositAmount))
        .accounts({
          vault: vaultOne,
          user: userOne.publicKey,
          userTokenAccount: userOneTokenAccount,
          userSharesAccount: userOneVaultOneSharesAccount,
        })
        .signers([userOne])
        .rpc();
    } catch (err) {
      expect(err.message).contains(
        "MinDepositNotReached. Error Number: 6016. Error Message: Min deposit not reached."
      );
    }

    const vaultTokenAccountInfo = await token.getAccount(
      connection,
      vaultTokenAccountOne
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultOneCurrentTokenBalance.toString()
    );

    const userSharesAccountInfo = await token.getAccount(
      connection,
      userOneVaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      userOneVaultOneSharesCurrentBalance.toString()
    );

    const userTokenAccountInfo = await token.getAccount(
      connection,
      userOneTokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOneUnderlyingTokenCurrentBalance.toString()
    );
  });

  it("Depositing amount that would make vault exceed the vault deposit limit should revert", async function () {
    this.qaseId(64);
    const depositAmount = 5000000000001;

    try {
      await vaultProgram.methods
        .deposit(new BN(depositAmount))
        .accounts({
          vault: vaultOne,
          user: userOne.publicKey,
          userTokenAccount: userOneTokenAccount,
          userSharesAccount: userOneVaultOneSharesAccount,
        })
        .signers([userOne])
        .rpc();
    } catch (err) {
      expect(err.message).contains(
        "ExceedDepositLimit. Error Number: 6017. Error Message: Exceed deposit limit."
      );
    }

    const vaultTokenAccountInfo = await token.getAccount(
      connection,
      vaultTokenAccountOne
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultOneCurrentTokenBalance.toString()
    );

    const userSharesAccountInfo = await token.getAccount(
      connection,
      userOneVaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      userOneVaultOneSharesCurrentBalance.toString()
    );

    const userTokenAccountInfo = await token.getAccount(
      connection,
      userOneTokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOneUnderlyingTokenCurrentBalance.toString()
    );
  });

  it("Depositing into the same vault with multiple users is successful", async function () {
    this.qaseId(65);
    const depositAmount = 50000000000;

    await vaultProgram.methods
      .deposit(new BN(depositAmount))
      .accounts({
        vault: vaultOne,
        user: userOne.publicKey,
        userTokenAccount: userOneTokenAccount,
        userSharesAccount: userOneVaultOneSharesAccount,
      })
      .signers([userOne])
      .rpc();

    await vaultProgram.methods
      .deposit(new BN(depositAmount))
      .accounts({
        vault: vaultOne,
        user: userTwo.publicKey,
        userTokenAccount: userTwoTokenAccount,
        userSharesAccount: userTwoVaultOneSharesAccount,
      })
      .signers([userTwo])
      .rpc();

    userOneUnderlyingTokenCurrentBalance -= depositAmount;
    userOneVaultOneSharesCurrentBalance += depositAmount;
    vaultOneCurrentTokenBalance += depositAmount * 2;
    userTwoUnderlyingTokenCurrentBalance -= depositAmount;
    userTwoVaultOneSharesCurrentBalance += depositAmount;

    const vaultTokenAccountOneInfo = await token.getAccount(
      connection,
      vaultTokenAccountOne
    );
    assert.strictEqual(
      vaultTokenAccountOneInfo.amount.toString(),
      vaultOneCurrentTokenBalance.toString()
    );

    const userSharesAccountOneInfo = await token.getAccount(
      connection,
      userOneVaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountOneInfo.amount.toString(),
      userOneVaultOneSharesCurrentBalance.toString()
    );

    const userTokenAccountOneInfo = await token.getAccount(
      connection,
      userOneTokenAccount
    );
    assert.strictEqual(
      userTokenAccountOneInfo.amount.toString(),
      userOneUnderlyingTokenCurrentBalance.toString()
    );

    const userSharesAccountTwoInfo = await token.getAccount(
      connection,
      userTwoVaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountTwoInfo.amount.toString(),
      userTwoVaultOneSharesCurrentBalance.toString()
    );
    const userTokenAccountTwoInfo = await token.getAccount(
      connection,
      userTwoTokenAccount
    );
    assert.strictEqual(
      userTokenAccountTwoInfo.amount.toString(),
      userTwoUnderlyingTokenCurrentBalance.toString()
    );
  });

  it("Depositing into different vaults with the same user is successful", async function () {
    this.qaseId(66);
    const depositAmount = 50000000000;

    await vaultProgram.methods
      .deposit(new BN(depositAmount))
      .accounts({
        vault: vaultOne,
        user: userOne.publicKey,
        userTokenAccount: userOneTokenAccount,
        userSharesAccount: userOneVaultOneSharesAccount,
      })
      .signers([userOne])
      .rpc();

    await vaultProgram.methods
      .deposit(new BN(depositAmount))
      .accounts({
        vault: vaultTwo,
        user: userOne.publicKey,
        userTokenAccount: userOneTokenAccount,
        userSharesAccount: userOneVaultTwoSharesAccount,
      })
      .signers([userOne])
      .rpc();

    userOneUnderlyingTokenCurrentBalance -= depositAmount * 2;
    userOneVaultOneSharesCurrentBalance += depositAmount;
    userOneVaultTwoSharesCurrentBalance += depositAmount;
    vaultOneCurrentTokenBalance += depositAmount;
    vaultTwoCurrentTokenBalance += depositAmount;

    const vaultTokenAccountOneInfo = await token.getAccount(
      connection,
      vaultTokenAccountOne
    );
    const vaultTokenAccountTwoInfo = await token.getAccount(
      connection,
      vaultTokenAccountTwo
    );
    assert.strictEqual(
      vaultTokenAccountOneInfo.amount.toString(),
      vaultOneCurrentTokenBalance.toString()
    );
    assert.strictEqual(
      vaultTokenAccountTwoInfo.amount.toString(),
      vaultTwoCurrentTokenBalance.toString()
    );

    const userSharesAccountOneInfo = await token.getAccount(
      connection,
      userOneVaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountOneInfo.amount.toString(),
      userOneVaultOneSharesCurrentBalance.toString()
    );
    const userSharesAccountTwoInfo = await token.getAccount(
      connection,
      userOneVaultTwoSharesAccount
    );
    assert.strictEqual(
      userSharesAccountTwoInfo.amount.toString(),
      userOneVaultTwoSharesCurrentBalance.toString()
    );

    const userTokenAccountInfo = await token.getAccount(
      connection,
      userOneTokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOneUnderlyingTokenCurrentBalance.toString()
    );
  });

  it("Depositing into a vault that is shut down should revert", async function () {
    this.qaseId(67);
    const depositAmount = 100000000000;

    try {
      await vaultProgram.methods
        .deposit(new BN(depositAmount))
        .accounts({
          vault: vaultThree,
          user: userOne.publicKey,
          userTokenAccount: userOneTokenAccount,
          userSharesAccount: userOneVaultThreeSharesAccount,
        })
        .signers([userOne])
        .rpc();
    } catch (err) {
      expect(err.message).contains(
        "VaultShutdown. Error Number: 6000. Error Message: Vault was shutdown."
      );
    }

    const vaultTokenAccountInfo = await token.getAccount(
      connection,
      vaultTokenAccountOne
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultOneCurrentTokenBalance.toString()
    );

    const userSharesAccountInfo = await token.getAccount(
      connection,
      userOneVaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      userOneVaultOneSharesCurrentBalance.toString()
    );

    const userTokenAccountInfo = await token.getAccount(
      connection,
      userOneTokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOneUnderlyingTokenCurrentBalance.toString()
    );
  });

  it("Depositing 0 value into a vault should revert", async function () {
    this.qaseId(68);
    const depositAmount = 0;

    try {
      await vaultProgram.methods
        .deposit(new BN(depositAmount))
        .accounts({
          vault: vaultOne,
          user: userOne.publicKey,
          userTokenAccount: userOneTokenAccount,
          userSharesAccount: userOneVaultOneSharesAccount,
        })
        .signers([userOne])
        .rpc();
    } catch (err) {
      expect(err.message).contains(
        "Error Code: Zer"
      );
    }

    userOneUnderlyingTokenCurrentBalance -= depositAmount;
    userOneVaultOneSharesCurrentBalance += depositAmount;
    vaultOneCurrentTokenBalance += depositAmount;

    const vaultTokenAccountInfo = await token.getAccount(
      connection,
      vaultTokenAccountOne
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultOneCurrentTokenBalance.toString()
    );

    const userSharesAccountInfo = await token.getAccount(
      connection,
      userOneVaultOneSharesAccount
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      userOneVaultOneSharesCurrentBalance.toString()
    );

    const userTokenAccountInfo = await token.getAccount(
      connection,
      userOneTokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      userOneUnderlyingTokenCurrentBalance.toString()
    );
  });
});
*/