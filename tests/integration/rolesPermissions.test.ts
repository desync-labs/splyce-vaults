import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StrategyProgram } from "../../target/types/strategy_program";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as borsh from "borsh";
import { assert, expect } from "chai";
import { SimpleStrategy, SimpleStrategySchema } from "../utils/schemas";
import {
  airdrop,
  initializeSimpleStrategy,
  initializeVault,
} from "../utils/helpers";

describe("Roles & Permissions Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;

  const vaultProgram = anchor.workspace
    .TokenizedVault as Program<TokenizedVault>;
  const strategyProgram = anchor.workspace
    .StrategyProgram as Program<StrategyProgram>;

  let rolesAdmin: anchor.web3.Keypair;
  let vaultsAdmin: anchor.web3.Keypair;
  let reportingManager: anchor.web3.Keypair;
  let whitelistedUser: anchor.web3.Keypair;
  let user: anchor.web3.Keypair;
  let underlyingMint: anchor.web3.PublicKey;
  let vault: anchor.web3.PublicKey;
  let sharesMint: anchor.web3.PublicKey;
  let vaultTokenAccount: anchor.web3.PublicKey;
  let strategy: anchor.web3.PublicKey;
  let strategyTokenAccount: anchor.web3.PublicKey;

  const vaultsAdminObj = { vaultsAdmin: {} };
  const reportingManagerObj = { reportingManager: {} };
  const whitelistedObj = { whitelisted: {} };

  const anchorError3012 = "AnchorError caused by account: roles. Error Code: AccountNotInitialized. Error Number: 3012. Error Message: The program expected this account to be already initialized.";

  before(async () => {
    rolesAdmin = anchor.web3.Keypair.generate();
    vaultsAdmin = anchor.web3.Keypair.generate();
    reportingManager = anchor.web3.Keypair.generate();
    whitelistedUser = anchor.web3.Keypair.generate();
    user = anchor.web3.Keypair.generate();

    console.log("Vault Program ID:", vaultProgram.programId.toBase58());
    console.log("Strategy Program ID:", strategyProgram.programId.toBase58());
    console.log("Roles Admin public key:", rolesAdmin.publicKey.toBase58());
    console.log("Vaults Admin public key:", vaultsAdmin.publicKey.toBase58());
    console.log(
      "Reporting Manager public key:",
      reportingManager.publicKey.toBase58()
    );
    console.log(
      "Whitelisted User public key:",
      whitelistedUser.publicKey.toBase58()
    );
    console.log("User public key:", user.publicKey.toBase58());

    // Aidrop to all accounts
    const publicKeysList = [
      rolesAdmin.publicKey,
      vaultsAdmin.publicKey,
      reportingManager.publicKey,
      whitelistedUser.publicKey,
      user.publicKey,
    ];
    for (const publicKey of publicKeysList) {
      await airdrop({
        connection,
        publicKey,
        amount: 10e9,
      });
    }

    // Init Roles Admin
    await vaultProgram.methods
      .initRoleAdmin()
      .accounts({
        admin: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    const rolesAdminPDA = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_admin_role")],
      vaultProgram.programId
    )[0];
    const rolesAccount = await vaultProgram.account.rolesAdmin.fetch(
      rolesAdminPDA
    );
    assert.strictEqual(
      rolesAccount.account.toString(),
      rolesAdmin.publicKey.toString()
    );

    // Set Roles for the common accounts
    await vaultProgram.methods
      .setRole(vaultsAdminObj)
      .accounts({
        user: vaultsAdmin.publicKey,
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();

    await vaultProgram.methods
      .setRole(reportingManagerObj)
      .accounts({
        user: reportingManager.publicKey,
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();

    await vaultProgram.methods
      .setRole(whitelistedObj)
      .accounts({
        user: whitelistedUser.publicKey,
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();

    // Create common underlying mint account
    underlyingMint = await token.createMint(
      connection,
      rolesAdmin,
      rolesAdmin.publicKey,
      null,
      18
    );

    // Initialize a common vault for tests
    [vault, sharesMint, vaultTokenAccount] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 1,
      signer: vaultsAdmin,
    });

    // Initialize a common strategy for tests
    [strategy, strategyTokenAccount] = await initializeSimpleStrategy({
      strategyProgram,
      vault,
      underlyingMint,
      signer: rolesAdmin,
    });
  });

  it("Roles Admin - Can successfully set Vault Admin role", async () => {
    const vaultsAdmin = anchor.web3.Keypair.generate();
    await vaultProgram.methods
      .setRole(vaultsAdminObj)
      .accounts({
        user: vaultsAdmin.publicKey,
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    const accountRoles = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("roles"), vaultsAdmin.publicKey.toBuffer()],
      vaultProgram.programId
    )[0];
    const vaultAdminAccount = await vaultProgram.account.accountRoles.fetch(
      accountRoles
    );
    assert.isTrue(vaultAdminAccount.isVaultsAdmin);
    assert.isTrue(!vaultAdminAccount.isReportingManager);
    assert.isTrue(!vaultAdminAccount.isWhitelisted);
  });

  it("Roles Admin - Can successfully set Reporting Manager role", async () => {
    const reportingManager = anchor.web3.Keypair.generate();
    await vaultProgram.methods
      .setRole(reportingManagerObj)
      .accounts({
        user: reportingManager.publicKey,
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    const accountRoles = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("roles"), reportingManager.publicKey.toBuffer()],
      vaultProgram.programId
    )[0];
    const reportingManagerAccount =
      await vaultProgram.account.accountRoles.fetch(accountRoles);
    assert.isTrue(reportingManagerAccount.isReportingManager);
    assert.isTrue(!reportingManagerAccount.isVaultsAdmin);
    assert.isTrue(!reportingManagerAccount.isWhitelisted);
  });

  it("Roles Admin - Can successfully set Whitelisted role", async () => {
    const whitelistedUser = anchor.web3.Keypair.generate();
    await vaultProgram.methods
      .setRole(whitelistedObj)
      .accounts({
        user: whitelistedUser.publicKey,
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    const accountRoles = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("roles"), whitelistedUser.publicKey.toBuffer()],
      vaultProgram.programId
    )[0];
    const whitelistedAccount = await vaultProgram.account.accountRoles.fetch(
      accountRoles
    );
    assert.isTrue(whitelistedAccount.isWhitelisted);
    assert.isTrue(!whitelistedAccount.isVaultsAdmin);
    assert.isTrue(!whitelistedAccount.isReportingManager);
  });

  it("Roles Admin - Can successfully set all 3 roles to the same user", async () => {
    const allRolesUser = anchor.web3.Keypair.generate();
    await vaultProgram.methods
      .setRole(vaultsAdminObj)
      .accounts({
        user: allRolesUser.publicKey,
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await vaultProgram.methods
      .setRole(reportingManagerObj)
      .accounts({
        user: allRolesUser.publicKey,
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await vaultProgram.methods
      .setRole(whitelistedObj)
      .accounts({
        user: allRolesUser.publicKey,
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
      .setRole(vaultsAdminObj)
      .accounts({
        user: allRolesUser.publicKey,
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await vaultProgram.methods
      .setRole(reportingManagerObj)
      .accounts({
        user: allRolesUser.publicKey,
        signer: rolesAdmin.publicKey,
      })
      .signers([rolesAdmin])
      .rpc();
    await vaultProgram.methods
      .setRole(whitelistedObj)
      .accounts({
        user: allRolesUser.publicKey,
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
        vaultIndex: 2,
        signer: rolesAdmin,
      });
      assert.fail("Error was not thrown");
    } catch (err) {
      assert.strictEqual(
        err.message,
        anchorError3012
      );
    }
  });

  it("Roles Admin - Adding a strategy to the vault should revert", async () => {
    try {
      await vaultProgram.methods
        .addStrategy(new BN(1000000000))
        .accounts({
          vault,
          strategy,
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      assert.strictEqual(
        err.message,
        anchorError3012
      );
    }
  });

  it("Roles Admin - Removing a strategy from the vault should revert", async () => {
    await vaultProgram.methods
      .addStrategy(new BN(1000000000))
      .accounts({
        vault,
        strategy,
        signer: vaultsAdmin.publicKey,
      })
      .signers([vaultsAdmin])
      .rpc();
    try {
      await vaultProgram.methods
        .removeStrategy(strategy, false)
        .accounts({
          vault,
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      assert.strictEqual(
        err.message,
        anchorError3012
      );
    }
  });

  it("Roles Admin - Shutting down the vault should revert", async () => {
    try {
      await vaultProgram.methods
        .shutdownVault()
        .accounts({
          vault,
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      assert.strictEqual(
        err.message,
        anchorError3012
      );
    }
  });

  it("Roles Admin - Update debt for the vault should revert", async () => {
    try {
      await vaultProgram.methods
        .updateDebt(new BN(100))
        .accounts({
          vault,
          vaultTokenAccount,
          strategy,
          strategyTokenAccount,
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      assert.strictEqual(
        err.message,
        anchorError3012
      );
    }
  });

  it("Roles Admin - Set deposit limit for the vault should revert", async () => {
    try {
      await vaultProgram.methods
        .setDepositLimit(new BN(2000))
        .accounts({
          vault,
          signer: rolesAdmin.publicKey,
        })
        .signers([rolesAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      assert.strictEqual(
        err.message,
        anchorError3012
      );
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
      provider.connection,
      feeRecipient,
      sharesMint,
      feeRecipient.publicKey
    );

    try {
      await vaultProgram.methods
        .processReport()
        .accounts({
          vault,
          strategy,
          signer: rolesAdmin.publicKey,
          feeSharesRecipient: feeRecipientSharesAccount,
          sharesMint,
        })
        .signers([rolesAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      assert.strictEqual(
        err.message,
        anchorError3012
      );
    }
  });

  it("Roles Admin - Depositing into the vault should revert", async () => {
    const rolesAdminTokenAccount = await token.createAccount(provider.connection, rolesAdmin, underlyingMint, rolesAdmin.publicKey);
    const rolesAdminSharesAccount = await token.createAccount(provider.connection, rolesAdmin, sharesMint, rolesAdmin.publicKey);
    await token.mintTo(connection, rolesAdmin, underlyingMint, rolesAdminTokenAccount, rolesAdmin.publicKey, 1000);

    try {
      await vaultProgram.methods.deposit(new BN(100))
        .accounts({
          vault,
          user: rolesAdmin.publicKey,
          userTokenAccount: rolesAdminTokenAccount,
          vaultTokenAccount,
          sharesMint,
          userSharesAccount: rolesAdminSharesAccount,
        })
        .signers([rolesAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      assert.strictEqual(
        err.message,
        anchorError3012
      );
    }
  });
});
