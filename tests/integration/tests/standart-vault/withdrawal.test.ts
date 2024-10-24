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

describe("Standard Vault: Withdrawal Tests", () => {
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
        vaultIndex: 21,
        signer: vaultsAndReportingAdmin,
        config: vaultConfig,
      });

    [vaultTwo, sharesMintTwo, metadataAccountTwo, vaultTokenAccountTwo] =
      await initializeVault({
        vaultProgram,
        underlyingMint,
        vaultIndex: 22,
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
      vaultIndex: 23,
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

  it("Withdrawing partially from a single strategy vault with non-allocated funds is successful", async function () {
    this.qaseId(69);
    // TO DO
  });

  it("Withdrawing fully from a single strategy vault with non-allocated funds is successful", async function () {
    this.qaseId(70);
    // TO DO
  });

  it("Withdrawing partially from a multi strategy vault with non-allocated funds is successful", async function () {
    this.qaseId(71);
    // TO DO
  });

  it("Withdrawing fully from a multi strategy vault with non-allocated funds is successful", async function () {
    this.qaseId(72);
    // TO DO
  });

  it("Withdrawing partially from a single strategy vault with fully allocated funds is successful", async function () {
    this.qaseId(73);
    // TO DO
  });

  it("Withdrawing fully from a single strategy vault with fully allocated funds is successful", async function () {
    this.qaseId(74);
    // TO DO
  });

  it("Withdrawing partially from a multi strategy vault with fully allocated funds to both strategies is successful", async function () {
    this.qaseId(75);
    // TO DO
  });

  it("Withdrawing fully from a multi strategy vault with fully allocated funds to both strategies is successful", async function () {
    this.qaseId(76);
    // TO DO
  });

  it("Withdrawing transferred shares from vault is successful", async function () {
    this.qaseId(77);
    // TO DO
  });

  it("Withdrawing more than deposited balance in the vault should revert", async function () {
    this.qaseId(78);
    // TO DO
  });

  it("Withdrawing from a shut down vault should revert", async function () {
    this.qaseId(79);
    // TO DO
  });

  // TO DO: Add max loss related test(s)
});
