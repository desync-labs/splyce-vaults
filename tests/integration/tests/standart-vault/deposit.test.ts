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

describe.only("Standard Vault: Deposit Tests", () => {
  let vaultsAndReportingAdmin: anchor.web3.Keypair;
  let userOne: anchor.web3.Keypair;
  let userOneTokenAccount: anchor.web3.PublicKey;
  let userOneVaultOneSharesAccount: anchor.web3.PublicKey;
  let userOneVaultTwoSharesAccount: anchor.web3.PublicKey;
  let underlyingMint: anchor.web3.PublicKey;
  let underlyingMintOwner: anchor.web3.Keypair;

  // First - For Role Admin
  let vaultOne: anchor.web3.PublicKey;
  let vaultTwo: anchor.web3.PublicKey;
  let sharesMintOne: anchor.web3.PublicKey;
  let sharesMintTwo: anchor.web3.PublicKey;
  let metadataAccountOne: anchor.web3.PublicKey;
  let metadataAccountTwo: anchor.web3.PublicKey;
  let vaultTokenAccountOne: anchor.web3.PublicKey;
  let vaultTokenAccountTwo: anchor.web3.PublicKey;
  let strategyOne: anchor.web3.PublicKey;
  let strategyTokenAccountOne: anchor.web3.PublicKey;
  let strategyTwo: anchor.web3.PublicKey;
  let strategyTokenAccountTwo: anchor.web3.PublicKey;
  let strategyThree: anchor.web3.PublicKey;
  let strategyTokenAccountThree: anchor.web3.PublicKey;

  let userOneUnderlyingTokenCurrentBalance: number = 0;
  let userOneVaultOneSharesCurrentBalance: number = 0;
  let userOneVaultTwoSharesCurrentBalance: number = 0;
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

    // Create whitelisted user token and shares accounts and mint underlying tokens
    userOneTokenAccount = await token.createAccount(
      connection,
      userOne,
      underlyingMint,
      userOne.publicKey
    );
    console.log("User token accounts created successfully");
    const mintAmount = 1000000000000;
    await token.mintTo(
      connection,
      underlyingMintOwner,
      underlyingMint,
      userOneTokenAccount,
      underlyingMintOwner.publicKey,
      mintAmount
    );
    userOneUnderlyingTokenCurrentBalance = mintAmount;
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
    console.log(
      "Created all required shares accounts to all users successfully"
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

    userOneUnderlyingTokenCurrentBalance =
      userOneUnderlyingTokenCurrentBalance - depositAmount;
    userOneVaultOneSharesCurrentBalance =
      userOneVaultOneSharesCurrentBalance + depositAmount;
    vaultOneCurrentTokenBalance = vaultOneCurrentTokenBalance + depositAmount;

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

    userOneUnderlyingTokenCurrentBalance =
      userOneUnderlyingTokenCurrentBalance - totalDepositAmount;
    userOneVaultOneSharesCurrentBalance =
      userOneVaultOneSharesCurrentBalance + totalDepositAmount;
    vaultOneCurrentTokenBalance =
      vaultOneCurrentTokenBalance + totalDepositAmount;

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

    console.log("Deposit success");

    userOneUnderlyingTokenCurrentBalance =
      userOneUnderlyingTokenCurrentBalance - depositAmount;
    userOneVaultTwoSharesCurrentBalance =
      userOneVaultTwoSharesCurrentBalance + depositAmount;
    vaultTwoCurrentTokenBalance = vaultTwoCurrentTokenBalance + depositAmount;

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

    userOneUnderlyingTokenCurrentBalance =
      userOneUnderlyingTokenCurrentBalance - totalDepositAmount;
    userOneVaultTwoSharesCurrentBalance =
      userOneVaultTwoSharesCurrentBalance + totalDepositAmount;
    vaultTwoCurrentTokenBalance =
      vaultTwoCurrentTokenBalance + totalDepositAmount;

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
});
