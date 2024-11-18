import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Strategy } from "../../../target/types/strategy";
import { TokenizedVault } from "../../../target/types/tokenized_vault";
import { airdrop } from "../../utils/helpers";
import { AccessControl } from "../../../target/types/access_control";
import { Accountant } from "../../../target/types/accountant";
import { assert } from "chai";
import { ROLES, ROLES_BUFFER } from "../../utils/constants";

anchor.setProvider(anchor.AnchorProvider.env());
export const provider = anchor.AnchorProvider.env();
export const workspace = anchor.workspace;
export const connection = provider.connection;
export let superAdmin: anchor.web3.Keypair;

export const accessControlProgram =
  workspace.AccessControl as Program<AccessControl>;
export const vaultProgram = workspace.TokenizedVault as Program<TokenizedVault>;
export const strategyProgram = workspace.Strategy as Program<Strategy>;
export const accountantProgram = workspace.Accountant as Program<Accountant>;

export async function mochaGlobalSetup() {
  console.log("-------Global Setup Started-------");
  superAdmin = anchor.web3.Keypair.generate();
  console.log("Super Admin public key:", superAdmin.publicKey.toBase58());

  await airdrop({
    connection,
    publicKey: superAdmin.publicKey,
    amount: 100e9,
  });

  await accessControlProgram.methods
    .initialize()
    .accounts({
      admin: superAdmin.publicKey,
    })
    .signers([superAdmin])
    .rpc();

  const roleManagerRolesAdminRole = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("role_manager"),
      ROLES_BUFFER.ROLES_ADMIN,
    ],
    accessControlProgram.programId
  )[0];

  const superAdminRolesAdminRole = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_role"),
      superAdmin.publicKey.toBuffer(),
      ROLES_BUFFER.ROLES_ADMIN,
    ],
    accessControlProgram.programId
  )[0];

  const roleManageRolesAdminRoleAccount = await accessControlProgram.account.roleManager.fetch(
    roleManagerRolesAdminRole
  );

  const superAdminRolesAdminRoleAccount = await accessControlProgram.account.userRole.fetch(
    superAdminRolesAdminRole
  );

  assert.equal(roleManageRolesAdminRoleAccount.managerRoleId, ROLES.ROLES_ADMIN);
  assert.isTrue(superAdminRolesAdminRoleAccount.hasRole);

  console.log("Access Control program and Super Admin initialized successfully");
  console.log("-------Global Setup Finished-------");
}
