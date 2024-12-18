import * as anchor from "@coral-xyz/anchor";
import {
  accessControlProgram,
  accountantProgram,
  configOwner,
  connection,
  provider,
  strategyProgram,
  vaultProgram,
  METADATA_SEED,
  TOKEN_METADATA_PROGRAM_ID,
} from "../../setups/globalSetup";
import { assert, expect } from "chai";
import { errorStrings, ROLES, ROLES_BUFFER } from "../../../utils/constants";
import { BN } from "@coral-xyz/anchor";
import {
  airdrop,
  initializeSimpleStrategy,
  initializeVault,
} from "../../../utils/helpers";
import * as token from "@solana/spl-token";
import { SimpleStrategyConfig } from "../../../utils/schemas";

describe("Vault User Operations: Direct Deposit Tests", () => {
  // Test Role Accounts
  let rolesAdmin: anchor.web3.Keypair;
  let generalAdmin: anchor.web3.Keypair;
  let kycVerifiedUser: anchor.web3.Keypair;
  let nonVerifiedUser: anchor.web3.Keypair;
  let whitelistedUser: anchor.web3.Keypair;
  let kycVerifiedWhitelistedUser: anchor.web3.Keypair;

  // Accountant vars
  let accountantConfig: anchor.web3.PublicKey;
  let accountantConfigAccount: { nextAccountantIndex: BN };
  const accountantType = { generic: {} };

  // Common underlying mint and owner
  let underlyingMint: anchor.web3.PublicKey;
  let underlyingMintOwner: anchor.web3.Keypair;

  // User token and shares accounts
  let kycVerifiedUserTokenAccount: anchor.web3.PublicKey;
  let kycVerifiedUserSharesAccountVaultOne: anchor.web3.PublicKey;
  let kycVerifiedUserCurrentAmount: number;

  let nonVerifiedUserTokenAccount: anchor.web3.PublicKey;
  let nonVerifiedUserSharesAccountVaultOne: anchor.web3.PublicKey;
  let nonVerifiedUserCurrentAmount: number;

  let whitelistedUserTokenAccount: anchor.web3.PublicKey;
  let whitelistedUserSharesAccountVaultOne: anchor.web3.PublicKey;
  let whitelistedUserCurrentAmount: number;

  let kycVerifiedWhitelistedUserTokenAccount: anchor.web3.PublicKey;
  let kycVerifiedWhitelistedUserSharesAccountVaultOne: anchor.web3.PublicKey;
  let kycVerifiedWhitelistedUserCurrentAmount: number;
  let kycVerifiedWhitelistedUserSharesCurrentAmountVaultOne: number;

  // First Test Vault
  let vaultOne: anchor.web3.PublicKey;
  let sharesMintOne: anchor.web3.PublicKey;
  let metadataAccountOne: anchor.web3.PublicKey;
  let vaultTokenAccountOne: anchor.web3.PublicKey;
  let strategyOne: anchor.web3.PublicKey;
  let strategyTokenAccountOne: anchor.web3.PublicKey;
  let accountantOne: anchor.web3.PublicKey;
  let feeRecipientOne: anchor.web3.Keypair;
  let feeRecipientSharesAccountOne: anchor.web3.PublicKey;
  let feeRecipientTokenAccountOne: anchor.web3.PublicKey;

  let vaultOneTokenAccountCurrentAmount: number;
  let vaultOneTotalDebtCurrentAmount: number;
  let vaultOneTotalSharesCurrentAmount: number;
  let strategyTokenAccountOneCurrentAmount: number;
  let strategyOneCurrentDebtAmount: number;

  before(async () => {
    console.log("-------Before Step Started-------");
    // Generate Test Role Accounts
    rolesAdmin = configOwner;
    generalAdmin = anchor.web3.Keypair.generate();
    kycVerifiedUser = anchor.web3.Keypair.generate();
    whitelistedUser = anchor.web3.Keypair.generate();
    nonVerifiedUser = anchor.web3.Keypair.generate();
    kycVerifiedWhitelistedUser = anchor.web3.Keypair.generate();
    feeRecipientOne = anchor.web3.Keypair.generate();

    // Airdrop to all accounts
    const publicKeysList = [
      generalAdmin.publicKey,
      kycVerifiedUser.publicKey,
      whitelistedUser.publicKey,
      nonVerifiedUser.publicKey,
      kycVerifiedWhitelistedUser.publicKey,
      feeRecipientOne.publicKey,
    ];
    for (const publicKey of publicKeysList) {
      await airdrop({
        connection,
        publicKey,
        amount: 10e9,
      });
    }

    console.log(
      "Generate keypairs and airdrop to all test accounts successfully"
    );

    // Create common underlying mint account and set underlying mint owner
    underlyingMintOwner = configOwner;
    underlyingMint = await token.createMint(
      connection,
      underlyingMintOwner,
      underlyingMintOwner.publicKey,
      null,
      9
    );

    console.log(
      "Underlying mint owner and underlying mint set up successfully"
    );

    // Set Corresponding Roles
    await accessControlProgram.methods
      .setRole(ROLES.ACCOUNTANT_ADMIN, generalAdmin.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.STRATEGIES_MANAGER, generalAdmin.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.VAULTS_ADMIN, generalAdmin.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.REPORTING_MANAGER, generalAdmin.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.KYC_PROVIDER, generalAdmin.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.KYC_VERIFIED, kycVerifiedUser.publicKey)
      .accounts({
        signer: generalAdmin.publicKey,
      })
      .signers([generalAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.KYC_VERIFIED, kycVerifiedWhitelistedUser.publicKey)
      .accounts({
        signer: generalAdmin.publicKey,
      })
      .signers([generalAdmin])
      .rpc();

    console.log("Set all roles successfully");

    // Set up accountant config
    accountantConfig = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      accountantProgram.programId
    )[0];

    // Set up test vaults and strategies
    // Vault One
    accountantConfigAccount = await accountantProgram.account.config.fetch(
      accountantConfig
    );
    accountantOne = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(
          new Uint8Array(
            new BigUint64Array([
              BigInt(accountantConfigAccount.nextAccountantIndex.toNumber()),
            ]).buffer
          )
        ),
      ],
      accountantProgram.programId
    )[0];

    await accountantProgram.methods
      .initAccountant(accountantType)
      .accounts({
        signer: generalAdmin.publicKey,
      })
      .signers([generalAdmin])
      .rpc();

    const vaultConfig = {
      depositLimit: new BN(100000000000),
      minUserDeposit: new BN(100000000),
      accountant: accountantOne,
      profitMaxUnlockTime: new BN(0),
      kycVerifiedOnly: true,
      directDepositEnabled: true,
      whitelistedOnly: true,
    };

    const sharesConfigOne = {
      name: "Test Roles and Permissions One",
      symbol: "TRPV1",
      uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
    };

    [vaultOne, sharesMintOne, metadataAccountOne, vaultTokenAccountOne] =
      await initializeVault({
        vaultProgram,
        underlyingMint,
        signer: generalAdmin,
        vaultConfig: vaultConfig,
        sharesConfig: sharesConfigOne,
      });

    feeRecipientSharesAccountOne = await token.createAccount(
      provider.connection,
      feeRecipientOne,
      sharesMintOne,
      feeRecipientOne.publicKey
    );
    feeRecipientTokenAccountOne = await token.createAccount(
      provider.connection,
      feeRecipientOne,
      underlyingMint,
      feeRecipientOne.publicKey
    );

    const strategyConfigOne = new SimpleStrategyConfig({
      depositLimit: new BN(100000000000),
      performanceFee: new BN(1000),
      feeManager: generalAdmin.publicKey,
    });

    [strategyOne, strategyTokenAccountOne] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultOne,
      underlyingMint,
      signer: generalAdmin,
      config: strategyConfigOne,
    });

    await vaultProgram.methods
      .addStrategy(new BN(100000000000))
      .accounts({
        vault: vaultOne,
        strategy: strategyOne,
        signer: generalAdmin.publicKey,
      })
      .signers([generalAdmin])
      .rpc();

    console.log("Initialized vaults and strategies successfully");

    // Whitelist users

    await vaultProgram.methods
      .whitelist(kycVerifiedWhitelistedUser.publicKey)
      .accounts({
        vault: vaultOne,
        signer: generalAdmin.publicKey,
      })
      .signers([generalAdmin])
      .rpc();
    await vaultProgram.methods
      .whitelist(whitelistedUser.publicKey)
      .accounts({
        vault: vaultOne,
        signer: generalAdmin.publicKey,
      })
      .signers([generalAdmin])
      .rpc();

    console.log("Whitelisted users successfully");

    // Create token accounts and mint underlying tokens
    await accountantProgram.methods
      .initTokenAccount()
      .accounts({
        accountant: accountantOne,
        signer: generalAdmin.publicKey,
        mint: underlyingMint,
      })
      .signers([generalAdmin])
      .rpc();

    await accountantProgram.methods
      .initTokenAccount()
      .accounts({
        accountant: accountantOne,
        signer: generalAdmin.publicKey,
        mint: sharesMintOne,
      })
      .signers([generalAdmin])
      .rpc();

    vaultOneTokenAccountCurrentAmount = 0;
    vaultOneTotalDebtCurrentAmount = 0;
    vaultOneTotalSharesCurrentAmount = 0;
    strategyTokenAccountOneCurrentAmount = 0;
    strategyOneCurrentDebtAmount = 0;

    kycVerifiedUserTokenAccount = await token.createAccount(
      connection,
      kycVerifiedUser,
      underlyingMint,
      kycVerifiedUser.publicKey
    );

    kycVerifiedUserSharesAccountVaultOne = await token.createAccount(
      provider.connection,
      kycVerifiedUser,
      sharesMintOne,
      kycVerifiedUser.publicKey
    );

    nonVerifiedUserTokenAccount = await token.createAccount(
      connection,
      nonVerifiedUser,
      underlyingMint,
      nonVerifiedUser.publicKey
    );

    nonVerifiedUserSharesAccountVaultOne = await token.createAccount(
      provider.connection,
      nonVerifiedUser,
      sharesMintOne,
      nonVerifiedUser.publicKey
    );

    whitelistedUserTokenAccount = await token.createAccount(
      connection,
      whitelistedUser,
      underlyingMint,
      whitelistedUser.publicKey
    );

    whitelistedUserSharesAccountVaultOne = await token.createAccount(
      provider.connection,
      whitelistedUser,
      sharesMintOne,
      whitelistedUser.publicKey
    );

    kycVerifiedWhitelistedUserTokenAccount = await token.createAccount(
      connection,
      kycVerifiedWhitelistedUser,
      underlyingMint,
      kycVerifiedWhitelistedUser.publicKey
    );

    kycVerifiedWhitelistedUserSharesAccountVaultOne = await token.createAccount(
      provider.connection,
      kycVerifiedWhitelistedUser,
      sharesMintOne,
      kycVerifiedWhitelistedUser.publicKey
    );

    console.log("Token accounts and shares accounts created successfully");

    const mintAmount = 200000000000;

    await token.mintTo(
      connection,
      underlyingMintOwner,
      underlyingMint,
      kycVerifiedUserTokenAccount,
      underlyingMintOwner.publicKey,
      mintAmount
    );

    await token.mintTo(
      connection,
      underlyingMintOwner,
      underlyingMint,
      nonVerifiedUserTokenAccount,
      underlyingMintOwner.publicKey,
      mintAmount
    );

    await token.mintTo(
      connection,
      underlyingMintOwner,
      underlyingMint,
      whitelistedUserTokenAccount,
      underlyingMintOwner.publicKey,
      mintAmount
    );

    await token.mintTo(
      connection,
      underlyingMintOwner,
      underlyingMint,
      kycVerifiedWhitelistedUserTokenAccount,
      underlyingMintOwner.publicKey,
      mintAmount
    );

    kycVerifiedUserCurrentAmount = mintAmount;
    nonVerifiedUserCurrentAmount = mintAmount;
    whitelistedUserCurrentAmount = mintAmount;
    kycVerifiedWhitelistedUserCurrentAmount = mintAmount;
    kycVerifiedWhitelistedUserSharesCurrentAmountVaultOne = 0;

    console.log("Minted underlying token to all users successfully");

    console.log("-------Before Step Finished-------");
  });

  it("Doing direct deposit with valid value into a direct deposit enabled vault is successful", async () => {
    const depositAmount = 100000000;

    const kycVerified = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_role"),
        kycVerifiedWhitelistedUser.publicKey.toBuffer(),
        ROLES_BUFFER.KYC_VERIFIED,
      ],
      accessControlProgram.programId
    )[0];

    await vaultProgram.methods
      .directDeposit(new BN(depositAmount))
      .accounts({
        vault: vaultOne,
        accountant: accountantOne,
        user: kycVerifiedWhitelistedUser.publicKey,
        userTokenAccount: kycVerifiedWhitelistedUserTokenAccount,
        userSharesAccount: kycVerifiedWhitelistedUserSharesAccountVaultOne,
        underlyingMint: underlyingMint,
        strategy: strategyOne,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .signers([kycVerifiedWhitelistedUser])
      .remainingAccounts([
        {
          pubkey: kycVerified,
          isWritable: false,
          isSigner: false,
        },
      ])
      .rpc();

    kycVerifiedWhitelistedUserCurrentAmount -= depositAmount;
    kycVerifiedWhitelistedUserSharesCurrentAmountVaultOne += depositAmount;
    vaultOneTotalDebtCurrentAmount += depositAmount;
    vaultOneTotalSharesCurrentAmount += depositAmount;
    strategyTokenAccountOneCurrentAmount += depositAmount;
    strategyOneCurrentDebtAmount += depositAmount;

    let userTokenAccountInfo = await token.getAccount(
      provider.connection,
      kycVerifiedWhitelistedUserTokenAccount
    );
    assert.strictEqual(
      userTokenAccountInfo.amount.toString(),
      kycVerifiedWhitelistedUserCurrentAmount.toString()
    );

    let userSharesAccountInfo = await token.getAccount(
      provider.connection,
      kycVerifiedWhitelistedUserSharesAccountVaultOne
    );
    assert.strictEqual(
      userSharesAccountInfo.amount.toString(),
      kycVerifiedWhitelistedUserSharesCurrentAmountVaultOne.toString()
    );

    let vaultTokenAccountInfo = await token.getAccount(
      provider.connection,
      vaultTokenAccountOne
    );
    assert.strictEqual(
      vaultTokenAccountInfo.amount.toString(),
      vaultOneTokenAccountCurrentAmount.toString()
    );

    const vaultAccount = await vaultProgram.account.vault.fetch(vaultOne);
    assert.strictEqual(
      vaultAccount.totalDebt.toString(),
      vaultOneTotalDebtCurrentAmount.toString()
    );
    assert.strictEqual(
      vaultAccount.totalShares.toString(),
      vaultOneTotalSharesCurrentAmount.toString()
    );

    let strategyTokenAccountInfo = await token.getAccount(
      provider.connection,
      strategyTokenAccountOne
    );
    assert.strictEqual(
      strategyTokenAccountInfo.amount.toString(),
      strategyTokenAccountOneCurrentAmount.toString()
    );

    const strategyData = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("strategy_data"),
        vaultOne.toBuffer(),
        strategyOne.toBuffer(),
      ],
      vaultProgram.programId
    )[0];
    const strategyDataAccount = await vaultProgram.account.strategyData.fetch(
      strategyData
    );
    assert.strictEqual(
      strategyDataAccount.currentDebt.toString(),
      strategyOneCurrentDebtAmount.toString()
    );
  });
});
