import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { assert, expect } from "chai";
import { SimpleStrategyConfig } from "../../utils/schemas";
import {
  airdrop,
  initializeSimpleStrategy,
  initializeVault,
} from "../../utils/helpers";
import {
  vaultProgram,
  strategyProgram,
  rolesAdmin,
  connection,
} from "../setups/globalSetup";

describe("Roles & Permissions Tests", () => {
  let vaultsAdmin: anchor.web3.Keypair;
  let reportingManager: anchor.web3.Keypair;
  let whitelistedUser: anchor.web3.Keypair;
  let whitelistedUserTokenAccount: anchor.web3.PublicKey;
  let underlyingMint: anchor.web3.PublicKey;
  let underlyingMintOwner: anchor.web3.Keypair;

  // First - For Role Admin
  let vaultOne: anchor.web3.PublicKey;
  let sharesMintOne: anchor.web3.PublicKey;
  let metadataAccountOne: anchor.web3.PublicKey;
  let vaultTokenAccountOne: anchor.web3.PublicKey;
  let strategyOne: anchor.web3.PublicKey;
  let strategyTokenAccountOne: anchor.web3.PublicKey;
  // Second - For Vault Admin
  let vaultTwo: anchor.web3.PublicKey;
  let sharesMintTwo: anchor.web3.PublicKey;
  let metadataAccountTwo: anchor.web3.PublicKey;
  let vaultTokenAccountTwo: anchor.web3.PublicKey;
  let strategyTwo: anchor.web3.PublicKey;
  let strategyTokenAccountTwo: anchor.web3.PublicKey;
  // Third - For Reporting Manager
  let vaultThree: anchor.web3.PublicKey;
  let sharesMintThree: anchor.web3.PublicKey;
  let metadataAccountThree: anchor.web3.PublicKey;
  let vaultTokenAccountThree: anchor.web3.PublicKey;
  let strategyThree: anchor.web3.PublicKey;
  let strategyTokenAccountThree: anchor.web3.PublicKey;
  // Fourth - For whitelisted user and regular / non-whitelisted user
  let vaultFour: anchor.web3.PublicKey;
  let sharesMintFour: anchor.web3.PublicKey;
  let metadataAccountFour: anchor.web3.PublicKey;
  let vaultTokenAccountFour: anchor.web3.PublicKey;
  let strategyFour: anchor.web3.PublicKey;
  let strategyTokenAccountFour: anchor.web3.PublicKey;

  const vaultsAdminObj = { vaultsAdmin: {} };
  const reportingManagerObj = { reportingManager: {} };
  const whitelistedObj = { whitelisted: {} };

  let vaultConfig: any;
  let strategyConfig: SimpleStrategyConfig;

  const anchorError3012 =
    "Error Code: AccountNotInitialized. Error Number: 3012. Error Message: The program expected this account to be already initialized.";
  const anchorError2012 =
    "Error Code: ConstraintAddress. Error Number: 2012. Error Message: An address constraint was violated.";
  const anchorError2003 =
    "Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated.";

  before(async () => {
    console.log("-------Before Step Started-------");
    vaultsAdmin = anchor.web3.Keypair.generate();
    reportingManager = anchor.web3.Keypair.generate();
    whitelistedUser = anchor.web3.Keypair.generate();
    underlyingMintOwner = rolesAdmin;

    console.log("Vault Program ID:", vaultProgram.programId.toBase58());
    console.log("Strategy Program ID:", strategyProgram.programId.toBase58());
    console.log(
      "Underlying Mint Token Owner key: ",
      underlyingMintOwner.publicKey.toBase58()
    );
    console.log("Vaults Admin public key:", vaultsAdmin.publicKey.toBase58());
    console.log(
      "Reporting Manager public key:",
      reportingManager.publicKey.toBase58()
    );
    console.log(
      "Whitelisted User public key:",
      whitelistedUser.publicKey.toBase58()
    );

    // Airdrop to all accounts
    const publicKeysList = [
      vaultsAdmin.publicKey,
      reportingManager.publicKey,
      whitelistedUser.publicKey,
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
      .setRole(vaultsAdminObj, vaultsAdmin.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();

    await vaultProgram.methods
      .setRole(reportingManagerObj, reportingManager.publicKey)
      .accounts({
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();

    await vaultProgram.methods
      .setRole(whitelistedObj, whitelistedUser.publicKey)
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
      name: "Roles & Permissions Test",
      symbol: "RPT",
      uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
      depositLimit: new BN(1000000000),
      minUserDeposit: new BN(0),
      performanceFee: new BN(1000),
      profitMaxUnlockTime: new BN(0),
    };

    strategyConfig = new SimpleStrategyConfig({
      depositLimit: new BN(1000),
      performanceFee: new BN(1),
      // @ts-ignore
      feeManager: vaultsAdmin.publicKey,
    });

    [vaultOne, sharesMintOne, metadataAccountOne, vaultTokenAccountOne] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 1,
      signer: vaultsAdmin,
      config: vaultConfig,
    });

    [vaultTwo, sharesMintTwo, metadataAccountTwo, vaultTokenAccountTwo] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 2,
      signer: vaultsAdmin,
      config: vaultConfig,
    });

    [vaultThree, sharesMintThree, metadataAccountThree, vaultTokenAccountThree] =
      await initializeVault({
        vaultProgram,
        underlyingMint,
        vaultIndex: 3,
        signer: vaultsAdmin,
        config: vaultConfig,
      });

    [vaultFour, sharesMintFour, metadataAccountFour, vaultTokenAccountFour] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 4,
      signer: vaultsAdmin,
      config: vaultConfig,
    });

    console.log("All Vaults initialized successfully");

    [strategyOne, strategyTokenAccountOne] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultOne,
      underlyingMint,
      signer: vaultsAdmin,
      index: 1,
      config: strategyConfig,
    });

    [strategyTwo, strategyTokenAccountTwo] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultTwo,
      underlyingMint,
      signer: vaultsAdmin,
      index: 1,
      config: strategyConfig,
    });

    [strategyThree, strategyTokenAccountThree] = await initializeSimpleStrategy(
      {
        strategyProgram,
        vault: vaultThree,
        underlyingMint,
        signer: vaultsAdmin,
        index: 1,
        config: strategyConfig,
      }
    );

    [strategyFour, strategyTokenAccountFour] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultFour,
      underlyingMint,
      signer: vaultsAdmin,
      index: 1,
      config: strategyConfig,
    });

    console.log("All Strategies initialized successfully");

    // Create whitelisted user token and shares accounts and mint underlying tokens
    whitelistedUserTokenAccount = await token.createAccount(
      connection,
      whitelistedUser,
      underlyingMint,
      whitelistedUser.publicKey
    );
    console.log("Whitelisted user token account created successfully");
    await token.mintTo(
      connection,
      underlyingMintOwner,
      underlyingMint,
      whitelistedUserTokenAccount,
      underlyingMintOwner.publicKey,
      1000
    );
    console.log(
      "Minted 1000 underlying tokens to Whitelisted user successfully"
    );
    console.log("-------Before Step Finished-------");
  });

  describe("Roles Admin Role Tests", () => {
    it("Roles Admin - Setting Vaults Admin role is successful", async () => {
      const vaultsAdminUserInner = anchor.web3.Keypair.generate();
      await vaultProgram.methods
        .setRole(vaultsAdminObj, vaultsAdminUserInner.publicKey)
        .accounts({
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      const accountRoles = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("roles"), vaultsAdminUserInner.publicKey.toBuffer()],
        vaultProgram.programId
      )[0];
      const vaultAdminAccount = await vaultProgram.account.accountRoles.fetch(
        accountRoles
      );
      assert.isTrue(vaultAdminAccount.isVaultsAdmin);
      assert.isTrue(!vaultAdminAccount.isReportingManager);
      assert.isTrue(!vaultAdminAccount.isWhitelisted);
    });

    it("Roles Admin - Setting Reporting Manager role is successful", async () => {
      const reportingManagerUserInner = anchor.web3.Keypair.generate();
      await vaultProgram.methods
        .setRole(reportingManagerObj, reportingManagerUserInner.publicKey)
        .accounts({
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      const accountRoles = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("roles"), reportingManagerUserInner.publicKey.toBuffer()],
        vaultProgram.programId
      )[0];
      const reportingManagerAccount =
        await vaultProgram.account.accountRoles.fetch(accountRoles);
      assert.isTrue(reportingManagerAccount.isReportingManager);
      assert.isTrue(!reportingManagerAccount.isVaultsAdmin);
      assert.isTrue(!reportingManagerAccount.isWhitelisted);
    });

    it("Roles Admin - Setting Whitelisted role is successful", async () => {
      const whitelistedUserInner = anchor.web3.Keypair.generate();
      await vaultProgram.methods
        .setRole(whitelistedObj, whitelistedUserInner.publicKey)
        .accounts({
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      const accountRoles = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("roles"), whitelistedUserInner.publicKey.toBuffer()],
        vaultProgram.programId
      )[0];
      const whitelistedAccount = await vaultProgram.account.accountRoles.fetch(
        accountRoles
      );
      assert.isTrue(whitelistedAccount.isWhitelisted);
      assert.isTrue(!whitelistedAccount.isVaultsAdmin);
      assert.isTrue(!whitelistedAccount.isReportingManager);
    });

    it("Roles Admin - Setting all 3 roles to the same user is successful", async () => {
      const allRolesUser = anchor.web3.Keypair.generate();
      await vaultProgram.methods
        .setRole(vaultsAdminObj, allRolesUser.publicKey)
        .accounts({
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      await vaultProgram.methods
        .setRole(reportingManagerObj, allRolesUser.publicKey)
        .accounts({
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      await vaultProgram.methods
        .setRole(whitelistedObj, allRolesUser.publicKey)
        .accounts({
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      const accountRoles = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("roles"), allRolesUser.publicKey.toBuffer()],
        vaultProgram.programId
      )[0];
      const allRolesAccount = await vaultProgram.account.accountRoles.fetch(
        accountRoles
      );
      assert.isTrue(allRolesAccount.isWhitelisted);
      assert.isTrue(allRolesAccount.isVaultsAdmin);
      assert.isTrue(allRolesAccount.isReportingManager);
    });

    // Drop role not working currently
    it.skip("Roles Admin - Can successfully drop a role", async () => {
      const allRolesUser = anchor.web3.Keypair.generate();
      await vaultProgram.methods
        .setRole(vaultsAdminObj, allRolesUser.publicKey)
        .accounts({
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      await vaultProgram.methods
        .setRole(reportingManagerObj, allRolesUser.publicKey)
        .accounts({
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      await vaultProgram.methods
        .setRole(whitelistedObj, allRolesUser.publicKey)
        .accounts({
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      const accountRoles = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("roles"), allRolesUser.publicKey.toBuffer()],
        vaultProgram.programId
      )[0];
      const allRolesAccount = await vaultProgram.account.accountRoles.fetch(
        accountRoles
      );
      assert.isTrue(allRolesAccount.isWhitelisted);
      assert.isTrue(allRolesAccount.isVaultsAdmin);
      assert.isTrue(allRolesAccount.isReportingManager);
      await vaultProgram.methods
        .dropRole(reportingManagerObj)
        .accounts({
          user: allRolesUser.publicKey,
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      await vaultProgram.methods
        .dropRole(whitelistedObj)
        .accounts({
          user: allRolesUser.publicKey,
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      assert.isTrue(allRolesAccount.isVaultsAdmin);
      assert.isTrue(!allRolesAccount.isWhitelisted);
      assert.isTrue(!allRolesAccount.isReportingManager);
    });

    it("Roles Admin - Initializing vault should revert", async () => {
      try {
        await initializeVault({
          vaultProgram,
          underlyingMint,
          vaultIndex: 5,
          signer: rolesAdmin,
          config: vaultConfig,
        });
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError3012);
      }
    });

    it("Roles Admin - Adding a strategy to the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .addStrategy(new BN(1000000000))
          .accounts({
            vault: vaultOne,
            strategy: strategyOne,
            signer: rolesAdmin.publicKey,
          })
          .signers([rolesAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError3012);
      }
    });

    it("Roles Admin - Removing a strategy from the vault should revert", async () => {
      await vaultProgram.methods
        .addStrategy(new BN(1000000000))
        .accounts({
          vault: vaultOne,
          strategy: strategyOne,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();
      try {
        await vaultProgram.methods
          .removeStrategy(strategyOne, false)
          .accounts({
            vault: vaultOne,
            signer: rolesAdmin.publicKey,
          })
          .signers([rolesAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError3012);
      }
    });

    it("Roles Admin - Shutting down the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .shutdownVault()
          .accounts({
            vault: vaultOne,
            signer: rolesAdmin.publicKey,
          })
          .signers([rolesAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError3012);
      }
    });

    it("Roles Admin - Update debt for the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .updateDebt(new BN(100))
          .accounts({
            vault: vaultOne,
            strategy: strategyOne,
            strategyTokenAccount: strategyTokenAccountOne,
            signer: rolesAdmin.publicKey,
            // @ts-ignore
            tokenProgram: token.TOKEN_PROGRAM_ID,
            strategyProgram: strategyProgram.programId,
          })
          .signers([rolesAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError3012);
      }
    });

    it("Roles Admin - Set deposit limit for the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .setDepositLimit(new BN(2000))
          .accounts({
            vault: vaultOne,
            signer: rolesAdmin.publicKey,
          })
          .signers([rolesAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError3012);
      }
    });

    it("Roles Admin - Process report for the vault should revert", async () => {
      const feeRecipient = anchor.web3.Keypair.generate();
      await airdrop({
        connection,
        publicKey: feeRecipient.publicKey,
        amount: 10e9,
      });
      const feeRecipientSharesAccount = await token.createAccount(
        connection,
        feeRecipient,
        sharesMintOne,
        feeRecipient.publicKey
      );

      try {
        await vaultProgram.methods
          .processReport()
          .accounts({
            vault: vaultOne,
            strategy: strategyOne,
            signer: rolesAdmin.publicKey,
            feeSharesRecipient: feeRecipientSharesAccount,
          })
          .signers([rolesAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError3012);
      }
    });

    // TO DO - need to either unskip later or modify the test
    it.skip("Roles Admin - Depositing into the vault should revert", async () => {
      const rolesAdminTokenAccount = await token.createAccount(
        connection,
        rolesAdmin,
        underlyingMint,
        rolesAdmin.publicKey
      );
      const rolesAdminSharesAccount = await token.createAccount(
        connection,
        rolesAdmin,
        sharesMintOne,
        rolesAdmin.publicKey
      );
      await token.mintTo(
        connection,
        underlyingMintOwner,
        underlyingMint,
        rolesAdminTokenAccount,
        underlyingMintOwner.publicKey,
        1000
      );

      try {
        await vaultProgram.methods
          .deposit(new BN(100))
          .accounts({
            vault: vaultOne,
            user: rolesAdmin.publicKey,
            userTokenAccount: rolesAdminTokenAccount,
            userSharesAccount: rolesAdminSharesAccount,
          })
          .signers([rolesAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError3012);
      }
    });
  });

  describe("Vaults Admin Role Tests", () => {
    it("Vaults Admin - Setting Vaults Admin role should revert", async () => {
      const vaultsAdminUserInner = anchor.web3.Keypair.generate();
      try {
        await vaultProgram.methods
          .setRole(vaultsAdminObj, vaultsAdminUserInner.publicKey)
          .accounts({
            signer: vaultsAdmin.publicKey,
          })
          .signers([vaultsAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contain(anchorError2012);
        expect(err.message).contains(rolesAdmin.publicKey);
        expect(err.message).contains(vaultsAdmin.publicKey);
      }
    });

    it("Vaults Admin - Setting Reporting Manager role should revert", async () => {
      const reportingManagerUserInner = anchor.web3.Keypair.generate();
      try {
        await vaultProgram.methods
          .setRole(vaultsAdminObj, reportingManagerUserInner.publicKey)
          .accounts({
            signer: vaultsAdmin.publicKey,
          })
          .signers([vaultsAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contain(anchorError2012);
        expect(err.message).contains(rolesAdmin.publicKey);
        expect(err.message).contains(vaultsAdmin.publicKey);
      }
    });

    it("Vaults Admin - Setting Whitelisted User role should revert", async () => {
      const whiteListedUserInner = anchor.web3.Keypair.generate();
      try {
        await vaultProgram.methods
          .setRole(vaultsAdminObj, whiteListedUserInner.publicKey)
          .accounts({
            signer: vaultsAdmin.publicKey,
          })
          .signers([vaultsAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contain(anchorError2012);
        expect(err.message).contains(rolesAdmin.publicKey);
        expect(err.message).contains(vaultsAdmin.publicKey);
      }
    });

    it("Vaults Admin - Initializing vault is successful", async () => {
      const [vaultInner, sharesMintInner, metadataAccountInner, vaultTokenAccountInner] =
        await initializeVault({
          vaultProgram,
          underlyingMint,
          vaultIndex: 6,
          signer: vaultsAdmin,
          config: vaultConfig,
        });
      const vaultAccountInner = await vaultProgram.account.vault.fetch(
        vaultInner
      );
      expect(vaultAccountInner.underlyingTokenAcc.toBase58()).to.equal(
        vaultTokenAccountInner.toBase58()
      );
      expect(vaultAccountInner.isShutdown).to.equal(false);
    });

    it("Vaults Admin - Adding a strategy to the vault is successful", async () => {
      await vaultProgram.methods
        .addStrategy(new BN(1000000000))
        .accounts({
          vault: vaultTwo,
          strategy: strategyTwo,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();
      const vaultAccount = await vaultProgram.account.vault.fetch(vaultTwo);
      assert.ok(vaultAccount.strategies[0].key.equals(strategyTwo));
    });

    it("Vaults Admin - Update debt for the vault is successful", async () => {
      const depositAmount = 100;
      const allocationAmount = 90;
      const whitelistedUserSharesTokenAccount = await token.createAccount(
        connection,
        whitelistedUser,
        sharesMintTwo,
        whitelistedUser.publicKey
      );

      await vaultProgram.methods
        .deposit(new BN(depositAmount))
        .accounts({
          vault: vaultTwo,
          user: whitelistedUser.publicKey,
          userTokenAccount: whitelistedUserTokenAccount,
          userSharesAccount: whitelistedUserSharesTokenAccount,
        })
        .signers([whitelistedUser])
        .rpc();

      await vaultProgram.methods
        .updateDebt(new BN(allocationAmount))
        .accounts({
          vault: vaultTwo,
          strategy: strategyTwo,
          strategyTokenAccount: strategyTokenAccountTwo,
          signer: vaultsAdmin.publicKey,
          // @ts-ignore
          tokenProgram: token.TOKEN_PROGRAM_ID,
          strategyProgram: strategyProgram.programId,
        })
        .signers([vaultsAdmin])
        .rpc();
      const vaultAccount = await vaultProgram.account.vault.fetch(vaultTwo);
      expect(Number(vaultAccount.strategies[0].currentDebt)).to.eql(
        allocationAmount
      );
      expect(Number(vaultAccount.totalDebt)).to.eql(allocationAmount);
      expect(Number(vaultAccount.totalIdle)).to.eql(
        depositAmount - allocationAmount
      );

      // Fetch the vault token account balance to verify the allocation
      const vaultTokenAccountInfo = await token.getAccount(
        connection,
        vaultTokenAccountTwo
      );
      assert.strictEqual(
        Number(vaultTokenAccountInfo.amount),
        depositAmount - allocationAmount
      );

      // Fetch the strategy token account balance to verify the allocation
      const strategyTokenAccountInfo = await token.getAccount(
        connection,
        strategyTokenAccountTwo
      );
      assert.strictEqual(
        Number(strategyTokenAccountInfo.amount),
        allocationAmount
      );

      // Fetch the strategy account to verify the state change
      const strategyAccount =
        await strategyProgram.account.simpleStrategy.fetch(strategyTwo);
      assert.strictEqual(Number(strategyAccount.totalAssets), allocationAmount);
    });

    it("Vaults Admin - Set deposit limit for the vault is successful", async () => {
      const depositLimit = new BN(2000);
      await vaultProgram.methods
        .setDepositLimit(depositLimit)
        .accounts({
          vault: vaultTwo,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();
      const vaultAccount = await vaultProgram.account.vault.fetch(vaultTwo);
      expect(Number(vaultAccount.depositLimit)).equals(Number(depositLimit));
    });

    it("Vaults Admin - Process report for the vault should revert", async () => {
      const feeRecipient = anchor.web3.Keypair.generate();
      await airdrop({
        connection,
        publicKey: feeRecipient.publicKey,
        amount: 10e9,
      });
      const feeRecipientSharesAccount = await token.createAccount(
        connection,
        feeRecipient,
        sharesMintTwo,
        feeRecipient.publicKey
      );

      try {
        await vaultProgram.methods
          .processReport()
          .accounts({
            vault: vaultTwo,
            strategy: strategyTwo,
            signer: vaultsAdmin.publicKey,
            feeSharesRecipient: feeRecipientSharesAccount,
          })
          .signers([vaultsAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    // TO DO - need to either unskip later or modify the test
    it.skip("Vaults Admin - Depositing into the vault should revert", async () => {
      const vaultsAdminTokenAccount = await token.createAccount(
        connection,
        vaultsAdmin,
        underlyingMint,
        vaultsAdmin.publicKey
      );
      const vaultsAdminSharesAccount = await token.createAccount(
        connection,
        vaultsAdmin,
        sharesMintTwo,
        vaultsAdmin.publicKey
      );
      await token.mintTo(
        connection,
        underlyingMintOwner,
        underlyingMint,
        vaultsAdminTokenAccount,
        underlyingMintOwner.publicKey,
        1000
      );

      try {
        await vaultProgram.methods
          .deposit(new BN(100))
          .accounts({
            vault: vaultTwo,
            user: vaultsAdmin.publicKey,
            userTokenAccount: vaultsAdminTokenAccount,
            userSharesAccount: vaultsAdminSharesAccount,
          })
          .signers([vaultsAdmin])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Vaults Admin - Removing a strategy from the vault is successful", async () => {
      await vaultProgram.methods
        .removeStrategy(strategyTwo, true)
        .accounts({
          vault: vaultTwo,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();
      const vaultAccount = await vaultProgram.account.vault.fetch(vaultTwo);
      assert.strictEqual(
        vaultAccount.strategies[0].key.toString(),
        "11111111111111111111111111111111"
      );
    });

    it("Vaults Admin - Shutting down the vault is successful", async () => {
      await vaultProgram.methods
        .shutdownVault()
        .accounts({
          vault: vaultTwo,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();
      const vaultAccountTwo = await vaultProgram.account.vault.fetch(vaultTwo);
      expect(vaultAccountTwo.isShutdown).to.equal(true);
    });
  });

  describe("Reporting Manager Role Tests", () => {
    it("Reporting Manager - Setting Vaults Admin role should revert", async () => {
      const vaultsAdminUserInner = anchor.web3.Keypair.generate();
      try {
        await vaultProgram.methods
          .setRole(vaultsAdminObj, vaultsAdminUserInner.publicKey)
          .accounts({
            signer: reportingManager.publicKey,
          })
          .signers([reportingManager])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contain(anchorError2012);
        expect(err.message).contains(rolesAdmin.publicKey);
        expect(err.message).contains(reportingManager.publicKey);
      }
    });

    it("Reporting Manager - Setting Reporting Manager role should revert", async () => {
      const reportingManagerUserInner = anchor.web3.Keypair.generate();
      try {
        await vaultProgram.methods
          .setRole(vaultsAdminObj, reportingManagerUserInner.publicKey)
          .accounts({
            signer: reportingManager.publicKey,
          })
          .signers([reportingManager])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contain(anchorError2012);
        expect(err.message).contains(rolesAdmin.publicKey);
        expect(err.message).contains(reportingManager.publicKey);
      }
    });

    it("Reporting Manager - Setting Whitelisted role should revert", async () => {
      const whiteListedUserInner = anchor.web3.Keypair.generate();
      try {
        await vaultProgram.methods
          .setRole(vaultsAdminObj, whiteListedUserInner.publicKey)
          .accounts({
            signer: reportingManager.publicKey,
          })
          .signers([reportingManager])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contain(anchorError2012);
        expect(err.message).contains(rolesAdmin.publicKey);
        expect(err.message).contains(reportingManager.publicKey);
      }
    });

    it("Reporting Manager - Initializing vault should revert", async () => {
      try {
        await initializeVault({
          vaultProgram,
          underlyingMint,
          vaultIndex: 7,
          signer: reportingManager,
          config: vaultConfig,
        });
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Reporting Manager - Adding a strategy to the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .addStrategy(new BN(1000000000))
          .accounts({
            vault: vaultThree,
            strategy: strategyThree,
            signer: reportingManager.publicKey,
          })
          .signers([reportingManager])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Reporting Manager - Removing a strategy from the vault should revert", async () => {
      await vaultProgram.methods
        .addStrategy(new BN(1000000000))
        .accounts({
          vault: vaultThree,
          strategy: strategyThree,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();
      try {
        await vaultProgram.methods
          .removeStrategy(strategyThree, false)
          .accounts({
            vault: vaultThree,
            signer: reportingManager.publicKey,
          })
          .signers([reportingManager])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Reporting Manager - Shutting down the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .shutdownVault()
          .accounts({
            vault: vaultThree,
            signer: reportingManager.publicKey,
          })
          .signers([reportingManager])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Reporting Manager - Update debt for the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .updateDebt(new BN(100))
          .accounts({
            vault: vaultThree,
            strategy: strategyThree,
            strategyTokenAccount: strategyTokenAccountThree,
            signer: reportingManager.publicKey,
            // @ts-ignore
            tokenProgram: token.TOKEN_PROGRAM_ID,
            strategyProgram: strategyProgram.programId,
          })
          .signers([reportingManager])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Reporting Manager - Set deposit limit for the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .setDepositLimit(new BN(2000))
          .accounts({
            vault: vaultThree,
            signer: reportingManager.publicKey,
          })
          .signers([reportingManager])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    // TO DO, need to validate assertions
    it("Reporting Manager - Process report is successful", async () => {
      const whitelistedUserSharesTokenAccount = await token.createAccount(
        connection,
        whitelistedUser,
        sharesMintThree,
        whitelistedUser.publicKey
      );

      // Deposit
      await vaultProgram.methods
        .deposit(new BN(100))
        .accounts({
          vault: vaultThree,
          user: whitelistedUser.publicKey,
          userTokenAccount: whitelistedUserTokenAccount,
          userSharesAccount: whitelistedUserSharesTokenAccount,
        })
        .signers([whitelistedUser])
        .rpc();

      // Allocate
      await vaultProgram.methods
        .updateDebt(new BN(100))
        .accounts({
          vault: vaultThree,
          strategy: strategyThree,
          strategyTokenAccount: strategyTokenAccountThree,
          signer: vaultsAdmin.publicKey,
          // @ts-ignore
          tokenProgram: token.TOKEN_PROGRAM_ID,
          strategyProgram: strategyProgram.programId,
        })
        .signers([vaultsAdmin])
        .rpc();

      // Simulate profit
      await token.mintTo(
        connection,
        underlyingMintOwner,
        underlyingMint,
        strategyTokenAccountThree,
        underlyingMintOwner.publicKey,
        50
      );

      const feeRecipient = anchor.web3.Keypair.generate();
      await airdrop({
        connection,
        publicKey: feeRecipient.publicKey,
        amount: 10e9,
      });
      const feeRecipientSharesAccount = await token.createAccount(
        connection,
        feeRecipient,
        sharesMintThree,
        feeRecipient.publicKey
      );

      await strategyProgram.methods
        .report()
        .accounts({
          strategy: strategyThree,
          signer: vaultsAdmin.publicKey,
          // @ts-ignore
          tokenProgram: token.TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          {
            pubkey: strategyTokenAccountThree,
            isWritable: true,
            isSigner: false,
          },
        ])
        .signers([vaultsAdmin])
        .rpc();

      await vaultProgram.methods
        .processReport()
        .accounts({
          vault: vaultThree,
          strategy: strategyThree,
          signer: reportingManager.publicKey,
          feeSharesRecipient: feeRecipientSharesAccount,
        })
        .signers([reportingManager])
        .rpc();

      // Assertions
      const vaultAccount = await vaultProgram.account.vault.fetch(vaultThree);
      assert.strictEqual(vaultAccount.totalShares.toString(), "103");

      // check fee balance
      const strategyAccount =
        await strategyProgram.account.simpleStrategy.fetch(strategyThree);
      assert.strictEqual(strategyAccount.feeData.feeBalance.toString(), "0");

      // check the strategy token account balance
      const strategyTokenAccountInfo = await token.getAccount(
        connection,
        strategyTokenAccountThree
      );
      assert.strictEqual(strategyTokenAccountInfo.amount.toString(), "150");

      // check the vault token account balance
      const vaultTokenAccountInfo = await token.getAccount(
        connection,
        vaultTokenAccountThree
      );
      assert.strictEqual(vaultTokenAccountInfo.amount.toString(), "0");
    });

    // TO DO - need to either unskip later or modify the test
    it.skip("Reporting Manager - Depositing into the vault should revert", async () => {
      const reportingManagerTokenAccount = await token.createAccount(
        connection,
        reportingManager,
        underlyingMint,
        reportingManager.publicKey
      );
      const reportingManagerSharesAccount = await token.createAccount(
        connection,
        reportingManager,
        sharesMintThree,
        reportingManager.publicKey
      );
      await token.mintTo(
        connection,
        underlyingMintOwner,
        underlyingMint,
        reportingManagerTokenAccount,
        underlyingMintOwner.publicKey,
        1000
      );

      try {
        await vaultProgram.methods
          .deposit(new BN(100))
          .accounts({
            vault: vaultThree,
            user: reportingManager.publicKey,
            userTokenAccount: reportingManagerTokenAccount,
            userSharesAccount: reportingManagerSharesAccount,
          })
          .signers([reportingManager])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });
  });

  describe("Whitelisted User Role Tests", () => {
    it("Whitelisted User - Setting Vaults Admin role should revert", async () => {
      const vaultsAdminUserInner = anchor.web3.Keypair.generate();
      try {
        await vaultProgram.methods
          .setRole(vaultsAdminObj, vaultsAdminUserInner.publicKey)
          .accounts({
            signer: whitelistedUser.publicKey,
          })
          .signers([whitelistedUser])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contain(anchorError2012);
        expect(err.message).contains(rolesAdmin.publicKey);
        expect(err.message).contains(whitelistedUser.publicKey);
      }
    });

    it("Whitelisted User - Setting Reporting Manager role should revert", async () => {
      const reportingManagerUserInner = anchor.web3.Keypair.generate();
      try {
        await vaultProgram.methods
          .setRole(vaultsAdminObj, reportingManagerUserInner.publicKey)
          .accounts({
            signer: whitelistedUser.publicKey,
          })
          .signers([whitelistedUser])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contain(anchorError2012);
        expect(err.message).contains(rolesAdmin.publicKey);
        expect(err.message).contains(whitelistedUser.publicKey);
      }
    });

    it("Whitelisted User - Setting Whitelisted role should revert", async () => {
      const whiteListedUserInner = anchor.web3.Keypair.generate();
      try {
        await vaultProgram.methods
          .setRole(vaultsAdminObj, whiteListedUserInner.publicKey)
          .accounts({
            signer: whitelistedUser.publicKey,
          })
          .signers([whitelistedUser])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contain(anchorError2012);
        expect(err.message).contains(rolesAdmin.publicKey);
        expect(err.message).contains(whitelistedUser.publicKey);
      }
    });

    it("Whitelisted User - Initializing vault should revert", async () => {
      try {
        await initializeVault({
          vaultProgram,
          underlyingMint,
          vaultIndex: 8,
          signer: whitelistedUser,
          config: vaultConfig,
        });
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Whitelisted User - Adding a strategy to the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .addStrategy(new BN(1000000000))
          .accounts({
            vault: vaultFour,
            strategy: strategyFour,
            signer: whitelistedUser.publicKey,
          })
          .signers([whitelistedUser])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Whitelisted User - Removing a strategy from the vault should revert", async () => {
      await vaultProgram.methods
        .addStrategy(new BN(1000000000))
        .accounts({
          vault: vaultFour,
          strategy: strategyFour,
          signer: vaultsAdmin.publicKey,
        })
        .signers([vaultsAdmin])
        .rpc();
      try {
        await vaultProgram.methods
          .removeStrategy(strategyFour, false)
          .accounts({
            vault: vaultFour,
            signer: whitelistedUser.publicKey,
          })
          .signers([whitelistedUser])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Whitelisted User - Shutting down the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .shutdownVault()
          .accounts({
            vault: vaultFour,
            signer: whitelistedUser.publicKey,
          })
          .signers([whitelistedUser])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Whitelisted User - Update debt for the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .updateDebt(new BN(100))
          .accounts({
            vault: vaultFour,
            strategy: strategyFour,
            strategyTokenAccount: strategyTokenAccountFour,
            signer: whitelistedUser.publicKey,
            // @ts-ignore
            tokenProgram: token.TOKEN_PROGRAM_ID,
            strategyProgram: strategyProgram.programId,
          })
          .signers([whitelistedUser])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Whitelisted User - Set deposit limit for the vault should revert", async () => {
      try {
        await vaultProgram.methods
          .setDepositLimit(new BN(2000))
          .accounts({
            vault: vaultFour,
            signer: whitelistedUser.publicKey,
          })
          .signers([whitelistedUser])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Whitelisted User - Process report for vault should revert", async () => {
      const feeRecipient = anchor.web3.Keypair.generate();
      await airdrop({
        connection,
        publicKey: feeRecipient.publicKey,
        amount: 10e9,
      });
      const feeRecipientSharesAccount = await token.createAccount(
        connection,
        feeRecipient,
        sharesMintFour,
        feeRecipient.publicKey
      );

      try {
        await vaultProgram.methods
          .processReport()
          .accounts({
            vault: vaultFour,
            strategy: strategyFour,
            signer: whitelistedUser.publicKey,
            feeSharesRecipient: feeRecipientSharesAccount,
          })
          .signers([whitelistedUser])
          .rpc();
        assert.fail("Error was not thrown");
      } catch (err) {
        expect(err.message).contains(anchorError2003);
      }
    });

    it("Whitelisted User - Depositing into the vault is successful", async () => {
      const depositAmount = 100;

      const whitelistedUserSharesAccount = await token.createAccount(
        connection,
        whitelistedUser,
        sharesMintFour,
        whitelistedUser.publicKey
      );

      await vaultProgram.methods
        .deposit(new BN(depositAmount))
        .accounts({
          vault: vaultFour,
          user: whitelistedUser.publicKey,
          userTokenAccount: whitelistedUserTokenAccount,
          userSharesAccount: whitelistedUserSharesAccount,
        })
        .signers([whitelistedUser])
        .rpc();

      // Fetch the vault token account balance to verify the deposit
      const vaultTokenAccountInfo = await token.getAccount(
        connection,
        vaultTokenAccountFour
      );
      assert.strictEqual(vaultTokenAccountInfo.amount.toString(), "100");

      // check the user shares account balance
      const userSharesAccountInfo = await token.getAccount(
        connection,
        whitelistedUserSharesAccount
      );
      assert.strictEqual(userSharesAccountInfo.amount.toString(), "100");
    });
  });
});
