import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StrategyProgram } from "../../target/types/strategy_program";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as borsh from "borsh";
import { assert, expect } from "chai";
import { SimpleStrategy, SimpleStrategySchema } from "../utils/schemas";
import { airdrop } from "../utils/helpers";

describe("Roles & Permissions Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const vaultProgram = anchor.workspace
    .TokenizedVault as Program<TokenizedVault>;
  const strategyProgram = anchor.workspace
    .StrategyProgram as Program<StrategyProgram>;

  let rolesAdmin: anchor.web3.Keypair;
  let vaultsAdmin: anchor.web3.Keypair;
  let reportingManager: anchor.web3.Keypair;
  let whitelistedUser: anchor.web3.Keypair;
  let user: anchor.web3.Keypair;
  let allRolesUser: anchor.web3.Keypair;

  const vaultsAdminObj = { vaultsAdmin: {} };
  const reportingManagerObj = { reportingManager: {} };
  const whitelistedObj = { whitelisted: {} };

  before(async () => {
    rolesAdmin = anchor.web3.Keypair.generate();
    vaultsAdmin = anchor.web3.Keypair.generate();
    reportingManager = anchor.web3.Keypair.generate();
    whitelistedUser = anchor.web3.Keypair.generate();
    user = anchor.web3.Keypair.generate();
    allRolesUser = anchor.web3.Keypair.generate();

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

    const provider = anchor.AnchorProvider.env();
    const connection = provider.connection;

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

    // Set Roles for the tests
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
    const reportingManagerAccount = await vaultProgram.account.accountRoles.fetch(
      accountRoles
    );
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
});
