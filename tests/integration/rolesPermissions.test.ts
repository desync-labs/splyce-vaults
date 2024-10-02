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

  // Global
  let rolesAdmin: anchor.web3.Keypair;
  let vaultsAdmin: anchor.web3.Keypair;
  let reportingManager: anchor.web3.Keypair;
  let whitelistedUser: anchor.web3.Keypair;
  let whitelistedUserTokenAccount: anchor.web3.PublicKey;
  let whitelistedUserSharesTokenAccount: anchor.web3.PublicKey;
  let user: anchor.web3.Keypair;
  let underlyingMint: anchor.web3.PublicKey;
  let underlyingMintOwner: anchor.web3.Keypair;
  // First - For Role Admin
  let vaultOne: anchor.web3.PublicKey;
  let sharesMintOne: anchor.web3.PublicKey;
  let vaultTokenAccountOne: anchor.web3.PublicKey;
  let strategyOne: anchor.web3.PublicKey;
  let strategyTokenAccountOne: anchor.web3.PublicKey;
  // Second - For Vault Admin
  let vaultTwo: anchor.web3.PublicKey;
  let sharesMintTwo: anchor.web3.PublicKey;
  let vaultTokenAccountTwo: anchor.web3.PublicKey;
  let strategyTwo: anchor.web3.PublicKey;
  let strategyTokenAccountTwo: anchor.web3.PublicKey;
  // Third - For Reporting Manager
  let vaultThree: anchor.web3.PublicKey;
  let sharesMintThree: anchor.web3.PublicKey;
  let vaultTokenAccountThree: anchor.web3.PublicKey;
  let strategyThree: anchor.web3.PublicKey;
  let strategyTokenAccountThree: anchor.web3.PublicKey;
  // Fourth - For whitelisted user and regular / non-whitelisted user
  let vaultFour: anchor.web3.PublicKey;
  let sharesMintFour: anchor.web3.PublicKey;
  let vaultTokenAccountFour: anchor.web3.PublicKey;
  let strategyFour: anchor.web3.PublicKey;
  let strategyTokenAccountFour: anchor.web3.PublicKey;

  const vaultsAdminObj = { vaultsAdmin: {} };
  const reportingManagerObj = { reportingManager: {} };
  const whitelistedObj = { whitelisted: {} };

  const anchorError3012 =
    "Error Code: AccountNotInitialized. Error Number: 3012. Error Message: The program expected this account to be already initialized.";
  const anchorError2012 =
    "Error Code: ConstraintAddress. Error Number: 2012. Error Message: An address constraint was violated.";
  const anchorError2003 =
    "Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated.";

  before(async () => {
    rolesAdmin = anchor.web3.Keypair.generate();
    vaultsAdmin = anchor.web3.Keypair.generate();
    reportingManager = anchor.web3.Keypair.generate();
    whitelistedUser = anchor.web3.Keypair.generate();
    user = anchor.web3.Keypair.generate();
    underlyingMintOwner = rolesAdmin;

    // Airdrop to all accounts
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
        amount: 100e9,
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
      underlyingMintOwner,
      underlyingMintOwner.publicKey,
      null,
      18
    );

    // Initialize vaults and strategies
    [vaultOne, sharesMintOne, vaultTokenAccountOne] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 1,
      signer: vaultsAdmin,
    });

    [vaultTwo, sharesMintTwo, vaultTokenAccountTwo] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 2,
      signer: vaultsAdmin,
    });

    [vaultThree, sharesMintThree, vaultTokenAccountThree] =
      await initializeVault({
        vaultProgram,
        underlyingMint,
        vaultIndex: 3,
        signer: vaultsAdmin,
      });

    [vaultFour, sharesMintFour, vaultTokenAccountFour] = await initializeVault({
      vaultProgram,
      underlyingMint,
      vaultIndex: 4,
      signer: vaultsAdmin,
    });

    [strategyOne, strategyTokenAccountOne] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultOne,
      underlyingMint,
      signer: vaultsAdmin,
      depositLimit: 1000,
      performanceFee: 1,
    });

    [strategyTwo, strategyTokenAccountTwo] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultTwo,
      underlyingMint,
      signer: vaultsAdmin,
      depositLimit: 1000,
      performanceFee: 1,
    });

    [strategyThree, strategyTokenAccountThree] = await initializeSimpleStrategy(
      {
        strategyProgram,
        vault: vaultThree,
        underlyingMint,
        signer: vaultsAdmin,
        depositLimit: 1000,
        performanceFee: 1,
      }
    );

    [strategyFour, strategyTokenAccountFour] = await initializeSimpleStrategy({
      strategyProgram,
      vault: vaultFour,
      underlyingMint,
      signer: vaultsAdmin,
      depositLimit: 1000,
      performanceFee: 1,
    });

    // Create whitelisted user token and shares accounts and mint underlying tokens
    whitelistedUserTokenAccount = await token.createAccount(
      provider.connection,
      whitelistedUser,
      underlyingMint,
      whitelistedUser.publicKey
    );
    whitelistedUserSharesTokenAccount = await token.createAccount(
      provider.connection,
      whitelistedUser,
      sharesMintTwo,
      whitelistedUser.publicKey
    );
    await token.mintTo(
      provider.connection,
      underlyingMintOwner,
      underlyingMint,
      whitelistedUserTokenAccount,
      underlyingMintOwner.publicKey,
      1000
    );
  });

  it("Roles Admin - Setting Vaults Admin role is successful", async () => {
    const vaultsAdminUserInner = anchor.web3.Keypair.generate();
    await vaultProgram.methods
      .setRole(vaultsAdminObj)
      .accounts({
        user: vaultsAdminUserInner.publicKey,
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
      .setRole(reportingManagerObj)
      .accounts({
        user: reportingManagerUserInner.publicKey,
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

  it("Roles Admin - Setting Whitelisted role is successful", async () => {
    const whitelistedUserInner = anchor.web3.Keypair.generate();
    await vaultProgram.methods
      .setRole(whitelistedObj)
      .accounts({
        user: whitelistedUserInner.publicKey,
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
        vaultIndex: 5,
        signer: rolesAdmin,
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
          vaultTokenAccount: vaultTokenAccountOne,
          strategy: strategyOne,
          strategyTokenAccount: strategyTokenAccountOne,
          signer: rolesAdmin.publicKey,
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
      provider.connection,
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
          sharesMint: sharesMintOne,
        })
        .signers([rolesAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      expect(err.message).contains(anchorError3012);
    }
  });

  it("Roles Admin - Depositing into the vault should revert", async () => {
    const rolesAdminTokenAccount = await token.createAccount(
      provider.connection,
      rolesAdmin,
      underlyingMint,
      rolesAdmin.publicKey
    );
    const rolesAdminSharesAccount = await token.createAccount(
      provider.connection,
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
          vaultTokenAccount: vaultTokenAccountOne,
          sharesMint: sharesMintOne,
          userSharesAccount: rolesAdminSharesAccount,
        })
        .signers([rolesAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      expect(err.message).contains(anchorError3012);
    }
  });

  it("Vaults Admin - Setting Vaults Admin role should revert", async () => {
    const vaultsAdminUserInner = anchor.web3.Keypair.generate();
    try {
      await vaultProgram.methods
        .setRole(vaultsAdminObj)
        .accounts({
          user: vaultsAdminUserInner.publicKey,
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
        .setRole(vaultsAdminObj)
        .accounts({
          user: reportingManagerUserInner.publicKey,
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
        .setRole(vaultsAdminObj)
        .accounts({
          user: whiteListedUserInner.publicKey,
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

  it("Vaults Admin - Process report for the vault should revert", async () => {
    const feeRecipient = anchor.web3.Keypair.generate();
    await airdrop({
      connection,
      publicKey: feeRecipient.publicKey,
      amount: 10e9,
    });
    const feeRecipientSharesAccount = await token.createAccount(
      provider.connection,
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
          sharesMint: sharesMintTwo,
        })
        .signers([vaultsAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      expect(err.message).contains(anchorError2003);
    }
  });

  it("Vaults Admin - Initializing vault is successful", async () => {
    const [vaultInner, sharesMintInner, vaultTokenAccountInner] =
      await initializeVault({
        vaultProgram,
        underlyingMint,
        vaultIndex: 6,
        signer: vaultsAdmin,
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
    await vaultProgram.methods
      .deposit(new BN(100))
      .accounts({
        vault: vaultTwo,
        user: whitelistedUser.publicKey,
        userTokenAccount: whitelistedUserTokenAccount,
        vaultTokenAccount: vaultTokenAccountTwo,
        sharesMint: sharesMintTwo,
        userSharesAccount: whitelistedUserSharesTokenAccount,
      })
      .signers([whitelistedUser])
      .rpc();

    const debt = new BN(100);
    await vaultProgram.methods
      .updateDebt(debt)
      .accounts({
        vault: vaultTwo,
        vaultTokenAccount: vaultTokenAccountTwo,
        strategy: strategyTwo,
        strategyTokenAccount: strategyTokenAccountTwo,
        signer: vaultsAdmin.publicKey,
      })
      .signers([vaultsAdmin])
      .rpc();
    const vaultAccount = await vaultProgram.account.vault.fetch(vaultTwo);
    expect(Number(vaultAccount.totalDebt)).to.eql(Number(debt));
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
      provider.connection,
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
          sharesMint: sharesMintTwo,
        })
        .signers([vaultsAdmin])
        .rpc();
      assert.fail("Error was not thrown");
    } catch (err) {
      expect(err.message).contains(anchorError2003);
    }
  });

  it("Vaults Admin - Depositing into the vault should revert", async () => {
    const vaultsAdminTokenAccount = await token.createAccount(
      provider.connection,
      vaultsAdmin,
      underlyingMint,
      vaultsAdmin.publicKey
    );
    const vaultsAdminSharesAccount = await token.createAccount(
      provider.connection,
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
          vaultTokenAccount: vaultTokenAccountTwo,
          sharesMint: sharesMintTwo,
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
