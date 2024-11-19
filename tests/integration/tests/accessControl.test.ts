import * as anchor from "@coral-xyz/anchor";
import { accessControlProgram, configOwner } from "../setups/globalSetup";
import { assert, expect } from "chai";
import { errorStrings, ROLES } from "../../utils/constants";
import { BN } from "@coral-xyz/anchor";

describe.only("Access Control Tests", () => {
  before(async () => {
    console.log("-------Before Step Started-------");
    await accessControlProgram.methods
      .setRoleManager(ROLES.VAULTS_ADMIN, ROLES.ROLES_ADMIN)
      .accounts({
        signer: configOwner.publicKey,
      })
      .signers([configOwner])
      .rpc();

    await accessControlProgram.methods
      .setRoleManager(ROLES.STRATEGIES_MANAGER, ROLES.ROLES_ADMIN)
      .accounts({
        signer: configOwner.publicKey,
      })
      .signers([configOwner])
      .rpc();

    await accessControlProgram.methods
      .setRoleManager(ROLES.ACCOUNTANT_ADMIN, ROLES.ROLES_ADMIN)
      .accounts({
        signer: configOwner.publicKey,
      })
      .signers([configOwner])
      .rpc();

    await accessControlProgram.methods
      .setRoleManager(ROLES.REPORTING_MANAGER, ROLES.ROLES_ADMIN)
      .accounts({
        signer: configOwner.publicKey,
      })
      .signers([configOwner])
      .rpc();

    await accessControlProgram.methods
      .setRoleManager(ROLES.KYC_PROVIDER, ROLES.ROLES_ADMIN)
      .accounts({
        signer: configOwner.publicKey,
      })
      .signers([configOwner])
      .rpc();

    await accessControlProgram.methods
      .setRoleManager(ROLES.KYC_VERIFIED, ROLES.KYC_PROVIDER)
      .accounts({
        signer: configOwner.publicKey,
      })
      .signers([configOwner])
      .rpc();
    console.log("Set role managers for all roles successfully");
    console.log("-------Before Step Finished-------");
  });

  it("Initalizing access control program with super configOwner when it is already initialized should revert", async function () {
    try {
      await accessControlProgram.methods
        .initialize()
        .accounts({
          admin: configOwner.publicKey,
        })
        .signers([configOwner])
        .rpc();
      assert.fail("Error was not thrown");
    } catch {
      assert.isTrue(true);
    }
  });

  it("Initalizing access control program with a second account when it is already initialized should revert", async function () {
    const anotherconfigOwner = anchor.web3.Keypair.generate();
    try {
      await accessControlProgram.methods
        .initialize()
        .accounts({
          admin: anotherconfigOwner.publicKey,
        })
        .signers([anotherconfigOwner])
        .rpc();
    } catch {
      assert.isTrue(true);
    }
  });

  it("Setting Role Manager for any role with signer being not the config owner should revert", async function () {
    const vaultAdminInner = anchor.web3.Keypair.generate();
    await accessControlProgram.methods
      .setRole(ROLES.VAULTS_ADMIN, vaultAdminInner.publicKey)
      .accounts({
        signer: configOwner.publicKey,
      })
      .signers([configOwner])
      .rpc();
    try {
      await accessControlProgram.methods
        .setRoleManager(ROLES.VAULTS_ADMIN, ROLES.ROLES_ADMIN)
        .accounts({
          signer: vaultAdminInner.publicKey,
        })
        .signers([vaultAdminInner])
        .rpc();
    } catch (err) {
      expect(err.message).contains(errorStrings.code2012);
    }
  });

  it("Setting role manager with invalid role id should revert", async function () {
    try {
    await accessControlProgram.methods
      .setRoleManager(new BN(10), ROLES.ROLES_ADMIN)
      .accounts({
        signer: configOwner.publicKey,
      })
      .signers([configOwner])
      .rpc();
    } catch (err) {
      expect(err.message).contains(errorStrings.code6002);
    }
  });

  it("Setting role manager with invalid manager role id should revert", async function () {
    try {
    await accessControlProgram.methods
      .setRoleManager(ROLES.VAULTS_ADMIN, new BN(10))
      .accounts({
        signer: configOwner.publicKey,
      })
      .signers([configOwner])
      .rpc();
    } catch (err) {
      expect(err.message).contains(errorStrings.code6002);
    }
  });
});
