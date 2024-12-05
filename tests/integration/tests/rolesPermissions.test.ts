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
} from "../setups/globalSetup";
import { assert, expect } from "chai";
import { errorStrings, ROLES, ROLES_BUFFER } from "../../utils/constants";
import { BN } from "@coral-xyz/anchor";
import {
  airdrop,
  initializeSimpleStrategy,
  initializeVault,
} from "../../utils/helpers";
import * as token from "@solana/spl-token";
import { SimpleStrategyConfig } from "../../utils/schemas";
import { min } from "bn.js";

describe.only("Roles and Permissions Tests", () => {
  // Test Role Accounts
  let rolesAdmin: anchor.web3.Keypair;
  let accountantAdmin: anchor.web3.Keypair;
  let strategiesManager: anchor.web3.Keypair;
  let vaultsAdmin: anchor.web3.Keypair;
  let reportingManager: anchor.web3.Keypair;
  let kycProvider: anchor.web3.Keypair;
  let kycVerifiedUser: anchor.web3.Keypair;
  let nonVerifiedUser: anchor.web3.Keypair;

  // Accountant vars
  let accountantConfig: anchor.web3.PublicKey;
  const accountantType = { generic: {} };

  // Common underlying mint and owner
  let underlyingMint: anchor.web3.PublicKey;
  let underlyingMintOwner: anchor.web3.Keypair;

  // User token and shares accounts
  let kycVerifiedUserTokenAccount: anchor.web3.PublicKey;
  let kycVerifiedUserSharesAccountVaultOne: anchor.web3.PublicKey;
  let kycVerifiedUserCurrentAmount: number;
  let strategiesManagerOneTokenAccount: anchor.web3.PublicKey;
  let strategiesManagerCurrentAmount: number;
  let nonVerifiedUserTokenAccount: anchor.web3.PublicKey;
  let nonVerifiedUserCurrentAmount: number;

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

  before(async () => {
    console.log("-------Before Step Started-------");
    // Generate Test Role Accounts
    rolesAdmin = configOwner;
    accountantAdmin = anchor.web3.Keypair.generate();
    strategiesManager = anchor.web3.Keypair.generate();
    vaultsAdmin = anchor.web3.Keypair.generate();
    reportingManager = anchor.web3.Keypair.generate();
    kycProvider = anchor.web3.Keypair.generate();
    kycVerifiedUser = anchor.web3.Keypair.generate();
    nonVerifiedUser = anchor.web3.Keypair.generate();
    feeRecipientOne = anchor.web3.Keypair.generate();

    // Airdrop to all accounts
    const publicKeysList = [
      accountantAdmin.publicKey,
      strategiesManager.publicKey,
      vaultsAdmin.publicKey,
      reportingManager.publicKey,
      kycProvider.publicKey,
      kycVerifiedUser.publicKey,
      nonVerifiedUser.publicKey,
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
      .setRole(ROLES.ACCOUNTANT_ADMIN, accountantAdmin.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.STRATEGIES_MANAGER, strategiesManager.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.VAULTS_ADMIN, vaultsAdmin.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.REPORTING_MANAGER, reportingManager.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.KYC_PROVIDER, kycProvider.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await accessControlProgram.methods
      .setRole(ROLES.KYC_VERIFIED, kycVerifiedUser.publicKey)
      .accounts({
        signer: kycProvider.publicKey,
      })
      .signers([kycProvider])
      .rpc();
    console.log("Set all roles successfully");

    // Set up accountant config
    accountantConfig = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      accountantProgram.programId
    )[0];

    // Set up test vaults and strategies
    // Vault One
    accountantOne = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(new Uint8Array(new BigUint64Array([BigInt(0)]).buffer))],
      accountantProgram.programId
    )[0];

    const vaultConfigOne = {
      depositLimit: new BN(1000000000),
      minUserDeposit: new BN(0),
      accountant: accountantOne,
      profitMaxUnlockTime: new BN(0),
      kycVerifiedOnly: true,
      directDepositEnabled: false,
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
        vaultIndex: 0,
        signer: vaultsAdmin,
        vaultConfig: vaultConfigOne,
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
      depositLimit: new BN(1000),
      performanceFee: new BN(1000),
      feeManager: strategiesManager.publicKey,
    });

    [strategyOne, strategyTokenAccountOne] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultOne,
      underlyingMint,
      signer: strategiesManager,
      index: 0,
      config: strategyConfigOne,
    });

    await vaultProgram.methods
      .addStrategy(new BN(1000000000))
      .accounts({
        vault: vaultOne,
        strategy: strategyOne,
        signer: vaultsAdmin.publicKey,
      })
      .signers([vaultsAdmin])
      .rpc();

    console.log("Initialized vaults and strategies successfully");

    // Create token accounts and mint underlying tokens
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

    strategiesManagerOneTokenAccount = await token.createAccount(
      connection,
      strategiesManager,
      underlyingMint,
      strategiesManager.publicKey
    );

    nonVerifiedUserTokenAccount = await token.createAccount(
      connection,
      nonVerifiedUser,
      underlyingMint,
      nonVerifiedUser.publicKey
    );

    console.log("Token accounts and shares accounts created successfully");

    const mintAmount = 1000;

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
      strategiesManagerOneTokenAccount,
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

    kycVerifiedUserCurrentAmount = mintAmount;
    strategiesManagerCurrentAmount = mintAmount;
    nonVerifiedUserCurrentAmount = mintAmount;

    console.log("Minted underlying token to KYC Verified user successfully");

    console.log("-------Before Step Finished-------");
  });

  describe("Accountant Admin Role Tests", () => {
    it("Accountant Admin - Init accountant is successful", async function () {
      await accountantProgram.methods
        .initAccountant(accountantType)
        .accounts({
          signer: accountantAdmin.publicKey,
          underlyingMint: sharesMintOne,
        })
        .signers([accountantAdmin])
        .rpc();

      let accountantConfigAccount =
        await accountantProgram.account.config.fetch(accountantConfig);
      assert.strictEqual(
        accountantConfigAccount.nextAccountantIndex.toNumber(),
        1
      );
    });

    it("Accountant Admin - Calling set fee method is successful", async function () {
      await accountantProgram.methods
        .setFee(new BN(500))
        .accounts({
          accountant: accountantOne,
          signer: accountantAdmin.publicKey,
        })
        .signers([accountantAdmin])
        .rpc();

      let genericAccountant =
        await accountantProgram.account.genericAccountant.fetch(accountantOne);
      assert.strictEqual(genericAccountant.performanceFee.toNumber(), 500);
    });

    it("Accountant Admin - Calling set fee recipient is successful", async function () {
      await accountantProgram.methods
        .setFeeRecipient(feeRecipientSharesAccountOne)
        .accounts({
          accountant: accountantOne,
          signer: accountantAdmin.publicKey,
        })
        .signers([accountantAdmin])
        .rpc();

      const genericAccountant =
        await accountantProgram.account.genericAccountant.fetch(accountantOne);
      assert.strictEqual(
        genericAccountant.feeRecipient.toString(),
        feeRecipientSharesAccountOne.toBase58()
      );
    });

    it("Accountant Admin - Calling distribute method is successful", async function () {
      try {
        await accountantProgram.methods
          .distribute()
          .accounts({
            recipient: feeRecipientSharesAccountOne,
            accountant: accountantOne,
            underlyingMint: sharesMintOne,
            signer: accountantAdmin.publicKey,
          })
          .signers([accountantAdmin])
          .rpc();
        assert.isTrue(true);
      } catch {
        assert.fail("Error was thrown");
      }
    });
  });

  describe("Strategies Manager Role Tests", () => {
    it("Strategies Manager - Calling init strategy method is successful", async () => {
      const strategyConfig = new SimpleStrategyConfig({
        depositLimit: new BN(1000),
        performanceFee: new BN(1),
        feeManager: strategiesManager.publicKey,
      });

      const [strategy, strategyTokenAccount] = await initializeSimpleStrategy({
        strategyProgram,
        vault: vaultOne,
        underlyingMint,
        signer: strategiesManager,
        index: 1,
        config: strategyConfig,
      });

      const strategyAccount =
        await strategyProgram.account.simpleStrategy.fetch(strategy);
      expect(strategyAccount.manager.toString()).to.equal(
        strategiesManager.publicKey.toBase58()
      );
    });
  });

  describe("Vaults Admin Role Tests", () => {
    it("Vaults Admin - Calling add strategy method is successful", async () => {
      const strategyConfig = new SimpleStrategyConfig({
        depositLimit: new BN(1000),
        performanceFee: new BN(1),
        feeManager: strategiesManager.publicKey,
      });

      const [strategy, strategyTokenAccount] = await initializeSimpleStrategy({
        strategyProgram,
        vault: vaultOne,
        underlyingMint,
        signer: strategiesManager,
        index: 2,
        config: strategyConfig,
      });

      await vaultProgram.methods
        .addStrategy(new BN(1000000000))
        .accounts({
          vault: vaultOne,
          strategy,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      const strategyData = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("strategy_data"),
          vaultOne.toBuffer(),
          strategy.toBuffer(),
        ],
        vaultProgram.programId
      )[0];

      const strategyDataAccount =
        await vaultProgram.account.strategyData.fetchNullable(strategyData);
      assert.isNotNull(strategyDataAccount);
    });

    it("Vaults Admin - Calling remove strategy method is successful", async () => {
      const strategyConfig = new SimpleStrategyConfig({
        depositLimit: new BN(1000),
        performanceFee: new BN(1),
        feeManager: strategiesManager.publicKey,
      });

      const [strategy, strategyTokenAccount] = await initializeSimpleStrategy({
        strategyProgram,
        vault: vaultOne,
        underlyingMint,
        signer: strategiesManager,
        index: 3,
        config: strategyConfig,
      });

      await vaultProgram.methods
        .addStrategy(new BN(1000000000))
        .accounts({
          vault: vaultOne,
          strategy,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      const strategyDataBefore = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("strategy_data"),
          vaultOne.toBuffer(),
          strategy.toBuffer(),
        ],
        vaultProgram.programId
      )[0];

      await vaultProgram.methods
        .removeStrategy(strategy, false)
        .accounts({
          vault: vaultOne,
          strategyData: strategyDataBefore,
          recipient: vaultsAdmin.publicKey,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      const strategyDataAfter = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("strategy_data"),
          vaultOne.toBuffer(),
          strategy.toBuffer(),
        ],
        vaultProgram.programId
      )[0];

      const strategyDataAccount =
        await vaultProgram.account.strategyData.fetchNullable(
          strategyDataAfter
        );
      assert.isNull(strategyDataAccount);
    });

    it("Vaults Admin - Calling init vault method is successful", async () => {
      const accountant = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(new Uint8Array(new BigUint64Array([BigInt(0)]).buffer))],
        accountantProgram.programId
      )[0];

      const vaultConfig = {
        depositLimit: new BN(1000000000),
        minUserDeposit: new BN(0),
        accountant: accountant,
        profitMaxUnlockTime: new BN(0),
        kycVerifiedOnly: true,
        directDepositEnabled: false,
      };

      await vaultProgram.methods
        .initVault(vaultConfig)
        .accounts({
          underlyingMint,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      const vault = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vault"),
          Buffer.from(new Uint8Array(new BigUint64Array([BigInt(1)]).buffer)),
        ],
        vaultProgram.programId
      )[0];

      let vaultAccount = await vaultProgram.account.vault.fetch(vault);
      assert.strictEqual(vaultAccount.isShutdown, false);
      assert.strictEqual(vaultAccount.depositLimit.toNumber(), 1000000000);
      assert.strictEqual(vaultAccount.minUserDeposit.toNumber(), 0);
      assert.strictEqual(
        vaultAccount.accountant.toString(),
        accountant.toBase58()
      );
      assert.strictEqual(vaultAccount.profitMaxUnlockTime.toNumber(), 0);
      assert.strictEqual(vaultAccount.kycVerifiedOnly, true);
      assert.strictEqual(vaultAccount.directDepositEnabled, false);
    });

    it("Vaults Admin - Calling init vault shares method is successful", async () => {
      const vault = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vault"),
          Buffer.from(new Uint8Array(new BigUint64Array([BigInt(1)]).buffer)),
        ],
        vaultProgram.programId
      )[0];

      const sharesMint = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("shares"), vault.toBuffer()],
        vaultProgram.programId
      )[0];

      const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(METADATA_SEED),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          sharesMint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      const sharesConfig = {
        name: "Localnet Tests Token",
        symbol: "LTT1",
        uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
      };

      await vaultProgram.methods
        .initVaultShares(new BN(1), sharesConfig)
        .accounts({
          metadata: metadataAddress,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      const config = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        vaultProgram.programId
      )[0];

      let configAccount = await vaultProgram.account.config.fetch(config);
      assert.strictEqual(configAccount.nextVaultIndex.toNumber(), 2);
    });

    it("Vaults Admin - Calling shutdown vault method is successful", async () => {
      const accountant = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(new Uint8Array(new BigUint64Array([BigInt(0)]).buffer))],
        accountantProgram.programId
      )[0];

      const vaultConfig = {
        depositLimit: new BN(1000000000),
        minUserDeposit: new BN(0),
        accountant: accountant,
        profitMaxUnlockTime: new BN(0),
        kycVerifiedOnly: true,
        directDepositEnabled: false,
      };

      const sharesConfig = {
        name: "Test Roles and Permissions One",
        symbol: "TRPV1",
        uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
      };

      const [vault, sharesMint, metadataAccount, vaultTokenAccount] =
        await initializeVault({
          vaultProgram,
          underlyingMint,
          vaultIndex: 2,
          signer: vaultsAdmin,
          vaultConfig: vaultConfig,
          sharesConfig: sharesConfig,
        });

      await vaultProgram.methods
        .shutdownVault()
        .accounts({ vault, signer: vaultsAdmin.publicKey })
        .signers([vaultsAdmin])
        .rpc();

      let vaultAccount = await vaultProgram.account.vault.fetch(vault);
      assert.strictEqual(vaultAccount.isShutdown, true);
      assert.strictEqual(vaultAccount.depositLimit.toNumber(), 0);
    });

    it("Vaults Admin - Calling close vault method is successful", async () => {
      const accountant = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(new Uint8Array(new BigUint64Array([BigInt(3)]).buffer))],
        accountantProgram.programId
      )[0];

      const vaultConfig = {
        depositLimit: new BN(1000000000),
        minUserDeposit: new BN(0),
        accountant: accountant,
        profitMaxUnlockTime: new BN(0),
        kycVerifiedOnly: true,
        directDepositEnabled: false,
      };

      const sharesConfig = {
        name: "Test Roles and Permissions One",
        symbol: "TRPV1",
        uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
      };

      const [vault, sharesMint, metadataAccount, vaultTokenAccount] =
        await initializeVault({
          vaultProgram,
          underlyingMint,
          vaultIndex: 3,
          signer: vaultsAdmin,
          vaultConfig: vaultConfig,
          sharesConfig: sharesConfig,
        });

      await vaultProgram.methods
        .shutdownVault()
        .accounts({ vault, signer: vaultsAdmin.publicKey })
        .signers([vaultsAdmin])
        .rpc();

      await vaultProgram.methods
        .closeVault()
        .accounts({
          vault,
          signer: vaultsAdmin.publicKey,
          recipient: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      let vaultAccount = await vaultProgram.account.vault.fetchNullable(vault);
      assert.isNull(vaultAccount);
    });

    it("Vaults Admin - Calling update debt method is successful", async () => {
      const depositAmount = 100;
      const allocationAmount = 100;
      const kycVerified = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_role"),
          kycVerifiedUser.publicKey.toBuffer(),
          ROLES_BUFFER.KYC_VERIFIED,
        ],
        accessControlProgram.programId
      )[0];

      await vaultProgram.methods
        .deposit(new BN(depositAmount))
        .accounts({
          vault: vaultOne,
          user: kycVerifiedUser.publicKey,
          userTokenAccount: kycVerifiedUserTokenAccount,
          userSharesAccount: kycVerifiedUserSharesAccountVaultOne,
        })
        .signers([kycVerifiedUser])
        .remainingAccounts([
          { pubkey: kycVerified, isWritable: false, isSigner: false },
        ])
        .rpc();

      kycVerifiedUserCurrentAmount -= depositAmount;

      await vaultProgram.methods
        .updateDebt(new BN(allocationAmount))
        .accounts({
          vault: vaultOne,
          strategy: strategyOne,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      let vaultTokenAccountInfo = await token.getAccount(
        provider.connection,
        vaultTokenAccountOne
      );
      assert.strictEqual(
        vaultTokenAccountInfo.amount.toString(),
        (depositAmount - allocationAmount).toString()
      );

      let strategyTokenAccountInfo = await token.getAccount(
        provider.connection,
        strategyTokenAccountOne
      );
      assert.strictEqual(
        strategyTokenAccountInfo.amount.toString(),
        allocationAmount.toString()
      );

      let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(
        strategyOne
      );
      assert.strictEqual(
        strategyAccount.totalAssets.toString(),
        allocationAmount.toString()
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
        allocationAmount.toString()
      );

      const vaultAccount = await vaultProgram.account.vault.fetch(vaultOne);

      assert.strictEqual(
        vaultAccount.totalDebt.toString(),
        allocationAmount.toString()
      );
      assert.strictEqual(
        vaultAccount.totalIdle.toString(),
        (depositAmount - allocationAmount).toString()
      );
    });

    it("Vaults Admin - Calling set deposit limit method is successful", async () => {
      const newDepositLimit = new BN(2000000000);

      await vaultProgram.methods
        .setDepositLimit(newDepositLimit)
        .accounts({
          vault: vaultOne,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      let vaultAccount = await vaultProgram.account.vault.fetch(vaultOne);
      assert.strictEqual(
        vaultAccount.depositLimit.toString(),
        newDepositLimit.toString()
      );
    });

    it("Vaults Admin - Calling set min user deposit method is successful", async () => {
      const newMinUserDeposit = 100;
      await vaultProgram.methods
        .setMinUserDeposit(new BN(newMinUserDeposit))
        .accounts({
          vault: vaultOne,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      const vaultAccount = await vaultProgram.account.vault.fetch(vaultOne);
      assert.strictEqual(
        vaultAccount.minUserDeposit.toString(),
        newMinUserDeposit.toString()
      );
    });

    it("Vaults Admin - Calling set profit max unlock time method is successful", async () => {
      const accountant = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(new Uint8Array(new BigUint64Array([BigInt(4)]).buffer))],
        accountantProgram.programId
      )[0];

      const vaultConfig = {
        depositLimit: new BN(1000000000),
        minUserDeposit: new BN(0),
        accountant: accountant,
        profitMaxUnlockTime: new BN(0),
        kycVerifiedOnly: true,
        directDepositEnabled: false,
      };

      const sharesConfig = {
        name: "Test Roles and Permissions One",
        symbol: "TRPV1",
        uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
      };

      const [vault, sharesMint, metadataAccount, vaultTokenAccount] =
        await initializeVault({
          vaultProgram,
          underlyingMint,
          vaultIndex: 4,
          signer: vaultsAdmin,
          vaultConfig: vaultConfig,
          sharesConfig: sharesConfig,
        });

      const newProfitMaxUnlockTime = 1;
      await vaultProgram.methods
        .setProfitMaxUnlockTime(new BN(1))
        .accounts({
          vault: vault,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      const vaultAccount = await vaultProgram.account.vault.fetch(vault);
      assert.strictEqual(
        vaultAccount.profitMaxUnlockTime.toString(),
        newProfitMaxUnlockTime.toString()
      );
    });

    it("Vaults Admin - Calling set min total idle method is successful", async () => {
      const accountant = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(new Uint8Array(new BigUint64Array([BigInt(4)]).buffer))],
        accountantProgram.programId
      )[0];

      const vaultConfig = {
        depositLimit: new BN(1000000000),
        minUserDeposit: new BN(0),
        accountant: accountant,
        profitMaxUnlockTime: new BN(0),
        kycVerifiedOnly: true,
        directDepositEnabled: false,
      };

      const sharesConfig = {
        name: "Test Roles and Permissions One",
        symbol: "TRPV1",
        uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
      };

      const [vault, sharesMint, metadataAccount, vaultTokenAccount] =
        await initializeVault({
          vaultProgram,
          underlyingMint,
          vaultIndex: 5,
          signer: vaultsAdmin,
          vaultConfig: vaultConfig,
          sharesConfig: sharesConfig,
        });

      const newMinTotalIdle = 1;
      await vaultProgram.methods
        .setMinTotalIdle(new BN(1))
        .accounts({
          vault: vault,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();

      const vaultAccount = await vaultProgram.account.vault.fetch(vault);
      assert.strictEqual(
        vaultAccount.minimumTotalIdle.toString(),
        newMinTotalIdle.toString()
      );
    });
  });

  describe("Reporting Manager Role Tests", () => {
    it("Reporting Manager - Calling process report method is successful", async () => {
      await strategyProgram.methods
        .reportProfit(new BN(10))
        .accounts({
          strategy: strategyOne,
          signer: strategiesManager.publicKey,
        })
        .remainingAccounts([
          {
            pubkey: strategiesManagerOneTokenAccount,
            isWritable: true,
            isSigner: false,
          },
        ])
        .signers([strategiesManager])
        .rpc();

      await vaultProgram.methods
        .processReport()
        .accounts({
          vault: vaultOne,
          strategy: strategyOne,
          signer: reportingManager.publicKey,
          accountant: accountantOne,
        })
        .signers([reportingManager])
        .rpc();

      const vaultAccount = await vaultProgram.account.vault.fetch(vaultOne);
      assert.strictEqual(vaultAccount.totalShares.toString(), "100");

      let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(
        strategyOne
      );
      assert.strictEqual(strategyAccount.feeData.feeBalance.toString(), "1");

      let strategyTokenAccountInfo = await token.getAccount(
        provider.connection,
        strategyTokenAccountOne
      );
      assert.strictEqual(strategyTokenAccountInfo.amount.toString(), "110");

      let vaultTokenAccountInfo = await token.getAccount(
        provider.connection,
        vaultTokenAccountOne
      );
      assert.strictEqual(vaultTokenAccountInfo.amount.toString(), "0");
    });
  });

  describe("KYC Verified User Role Tests", () => {
    it("KYC Verified User - Calling deposit method for kyc verified only vault is successful", async () => {
      const depositAmount = 50;

      const accountant = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(new Uint8Array(new BigUint64Array([BigInt(6)]).buffer))],
        accountantProgram.programId
      )[0];

      const vaultConfig = {
        depositLimit: new BN(1000000000),
        minUserDeposit: new BN(0),
        accountant: accountant,
        profitMaxUnlockTime: new BN(0),
        kycVerifiedOnly: true,
        directDepositEnabled: false,
      };

      const sharesConfig = {
        name: "Test Roles and Permissions One",
        symbol: "TRPV1",
        uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
      };

      const [vault, sharesMint, metadataAccount, vaultTokenAccount] =
        await initializeVault({
          vaultProgram,
          underlyingMint,
          vaultIndex: 6,
          signer: vaultsAdmin,
          vaultConfig: vaultConfig,
          sharesConfig: sharesConfig,
        });

      const userSharesAccount = await token.createAccount(
        provider.connection,
        kycVerifiedUser,
        sharesMint,
        kycVerifiedUser.publicKey
      );

      const kycVerified = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_role"),
          kycVerifiedUser.publicKey.toBuffer(),
          ROLES_BUFFER.KYC_VERIFIED,
        ],
        accessControlProgram.programId
      )[0];

      await vaultProgram.methods
        .deposit(new BN(depositAmount))
        .accounts({
          vault: vault,
          user: kycVerifiedUser.publicKey,
          userTokenAccount: kycVerifiedUserTokenAccount,
          userSharesAccount: userSharesAccount,
        })
        .signers([kycVerifiedUser])
        .remainingAccounts([
          { pubkey: kycVerified, isWritable: false, isSigner: false },
        ])
        .rpc();

      kycVerifiedUserCurrentAmount -= depositAmount;

      let vaultTokenAccountInfo = await token.getAccount(
        provider.connection,
        vaultTokenAccount
      );

      assert.strictEqual(
        vaultTokenAccountInfo.amount.toString(),
        depositAmount.toString()
      );

      let userTokenAccountInfo = await token.getAccount(
        provider.connection,
        kycVerifiedUserTokenAccount
      );
      assert.strictEqual(
        userTokenAccountInfo.amount.toString(),
        kycVerifiedUserCurrentAmount.toString()
      );

      let userSharesAccountInfo = await token.getAccount(
        provider.connection,
        userSharesAccount
      );
      assert.strictEqual(
        userSharesAccountInfo.amount.toString(),
        depositAmount.toString()
      );
    });
  });

  describe("Non-KYC Verified User Role Tests", () => {
    it("Non-KYC Verified User - Calling deposit method for kyc verified only vault should revert", async () => {
      const depositAmount = 50;

      const accountant = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(new Uint8Array(new BigUint64Array([BigInt(7)]).buffer))],
        accountantProgram.programId
      )[0];

      const vaultConfig = {
        depositLimit: new BN(1000000000),
        minUserDeposit: new BN(0),
        accountant: accountant,
        profitMaxUnlockTime: new BN(0),
        kycVerifiedOnly: true,
        directDepositEnabled: false,
      };

      const sharesConfig = {
        name: "Test Roles and Permissions One",
        symbol: "TRPV1",
        uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
      };

      const [vault, sharesMint, metadataAccount, vaultTokenAccount] =
        await initializeVault({
          vaultProgram,
          underlyingMint,
          vaultIndex: 7,
          signer: vaultsAdmin,
          vaultConfig: vaultConfig,
          sharesConfig: sharesConfig,
        });

      const userSharesAccount = await token.createAccount(
        provider.connection,
        nonVerifiedUser,
        sharesMint,
        nonVerifiedUser.publicKey
      );

      const kycVerified = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_role"),
          nonVerifiedUser.publicKey.toBuffer(),
          ROLES_BUFFER.KYC_VERIFIED,
        ],
        accessControlProgram.programId
      )[0];

      try {
        await vaultProgram.methods
          .deposit(new BN(depositAmount))
          .accounts({
            vault: vault,
            user: nonVerifiedUser.publicKey,
            userTokenAccount: nonVerifiedUserTokenAccount,
            userSharesAccount: userSharesAccount,
          })
          .signers([nonVerifiedUser])
          .remainingAccounts([
            {
              pubkey: kycVerified,
              isWritable: false,
              isSigner: false,
            },
          ])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).to.contain(errorStrings.kycRequired);
      }

      let vaultTokenAccountInfo = await token.getAccount(
        provider.connection,
        vaultTokenAccount
      );

      assert.strictEqual(vaultTokenAccountInfo.amount.toString(), "0");

      let userTokenAccountInfo = await token.getAccount(
        provider.connection,
        nonVerifiedUserTokenAccount
      );
      assert.strictEqual(
        userTokenAccountInfo.amount.toString(),
        nonVerifiedUserCurrentAmount.toString()
      );

      let userSharesAccountInfo = await token.getAccount(
        provider.connection,
        userSharesAccount
      );
      assert.strictEqual(userSharesAccountInfo.amount.toString(), "0");
    });
  });
});
