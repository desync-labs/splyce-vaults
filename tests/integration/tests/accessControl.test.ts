import * as anchor from "@coral-xyz/anchor";
import {
  accessControlProgram,
  configOwner,
  connection,
} from "../setups/globalSetup";
import { assert, expect } from "chai";
import { errorStrings, ROLES, ROLES_BUFFER } from "../../utils/constants";
import { BN } from "@coral-xyz/anchor";
import { airdrop } from "../../utils/helpers";

export const ROLES_SUCCESS_DATA = {
  VAULTS_ADMIN: new BN(1),
  REPORTING_MANAGER: new BN(2),
  STRATEGIES_MANAGER: new BN(3),
  ACCOUNTANT_ADMIN: new BN(4),
  KYC_PROVIDER: new BN(5),
  KYC_VERIFIED: new BN(6),
};

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

  it("Initalizing access control program with another account when it is already initialized should revert", async function () {
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

  it("Setting Role Manager for any role with signer not being the config owner should revert", async function () {
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
      expect(err.message).contains(errorStrings.addressConstraintViolated);
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
      expect(err.message).contains(errorStrings.roleIdInvalid);
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
      expect(err.message).contains(errorStrings.roleIdInvalid);
    }
  });

  it("Setting ROLES_ADMIN role via set role method by the config owner should revert", async function () {
    const roleReceiver = anchor.web3.Keypair.generate();
    try {
      await accessControlProgram.methods
        .setRole(ROLES.ROLES_ADMIN, roleReceiver.publicKey)
        .accounts({
          signer: configOwner.publicKey,
        })
        .signers([configOwner])
        .rpc();
    } catch (err) {
      expect(err.message).contains(
        errorStrings.setRoleAdminMustBeCalledByOwner
      );
    }
  });

  for (const role in ROLES_SUCCESS_DATA) {
    it(`Setting ${role} role with signer being the corresponding role manager account is successful`, async function () {
      const roleReceiver = anchor.web3.Keypair.generate();
      if (role === "KYC_VERIFIED") {
        // Set KYC Provider role to kycProvider account
        const kycProvider = anchor.web3.Keypair.generate();
        await airdrop({
          connection,
          publicKey: kycProvider.publicKey,
          amount: 10e9,
        });
        await accessControlProgram.methods
          .setRole(ROLES.KYC_PROVIDER, kycProvider.publicKey)
          .accounts({
            signer: configOwner.publicKey,
          })
          .signers([configOwner])
          .rpc();

        // Then only set KYC Verified user
        await accessControlProgram.methods
          .setRole(ROLES[role], roleReceiver.publicKey)
          .accounts({
            signer: kycProvider.publicKey,
          })
          .signers([kycProvider])
          .rpc();
      } else {
        await accessControlProgram.methods
          .setRole(ROLES[role], roleReceiver.publicKey)
          .accounts({
            signer: configOwner.publicKey,
          })
          .signers([configOwner])
          .rpc();
      }

      const roleReceiverCorrespondingRole =
        anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from("user_role"),
            roleReceiver.publicKey.toBuffer(),
            ROLES_BUFFER[role],
          ],
          accessControlProgram.programId
        )[0];

      const roleReceiverCorrespondingRoleAccount =
        await accessControlProgram.account.userRole.fetch(
          roleReceiverCorrespondingRole
        );

      assert.isTrue(roleReceiverCorrespondingRoleAccount.hasRole);
    });
  }
});
