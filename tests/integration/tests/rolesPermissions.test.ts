import * as anchor from "@coral-xyz/anchor";
import {
  accessControlProgram,
  accountantProgram,
  configOwner,
  connection,
  provider,
  strategyProgram,
  vaultProgram,
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

describe("Roles and Permissions Tests", () => {
  // Test Role Accounts
  let rolesAdmin: anchor.web3.Keypair;
  let accountantAdmin: anchor.web3.Keypair;
  let strategiesManager: anchor.web3.Keypair;
  let vaultsAdmin: anchor.web3.Keypair;
  let reportingManager: anchor.web3.Keypair;
  let kycProvider: anchor.web3.Keypair;
  let kycVerifiedUser: anchor.web3.Keypair;
  let nonVerifiedUser: anchor.web3.Keypair;

  // Next indexes
  let nextAccountantIndex = 0;
  let nextVaultIndex = 0;
  let nextStrategyIndex = 0;

  // Accountant vars
  let accountantConfig: anchor.web3.PublicKey;
  const accountantType = { generic: {} };

  // Common underlying mint and owner
  let underlyingMint: anchor.web3.PublicKey;
  let underlyingMintOwner: anchor.web3.Keypair;

  // First Test Vault
  let vaultOne: anchor.web3.PublicKey;
  let sharesMintOne: anchor.web3.PublicKey;
  let metadataAccountOne: anchor.web3.PublicKey;
  let vaultTokenAccountOne: anchor.web3.PublicKey;
  let strategyOneVaultOne: anchor.web3.PublicKey;
  let strategyTokenAccountOneVaultOne: anchor.web3.PublicKey;
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
        vaultIndex: nextVaultIndex,
        signer: vaultsAdmin,
        vaultConfig: vaultConfigOne,
        sharesConfig: sharesConfigOne,
      });

    nextVaultIndex++;

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

    console.log("Initialized vaults and strategies successfully");

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

      nextAccountantIndex++;

      let accountantConfigAccount =
        await accountantProgram.account.config.fetch(accountantConfig);
      assert.strictEqual(
        accountantConfigAccount.nextAccountantIndex.toNumber(),
        nextAccountantIndex
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
        index: nextStrategyIndex,
        config: strategyConfig,
      });

      nextStrategyIndex++;

      const strategyAccount =
        await strategyProgram.account.simpleStrategy.fetch(strategy);
      expect(strategyAccount.manager.toString()).to.equal(
        strategiesManager.publicKey.toBase58()
      );
    });
  });
});
