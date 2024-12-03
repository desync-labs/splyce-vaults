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
export let configOwner: anchor.web3.Keypair;

export const accessControlProgram =
  workspace.AccessControl as Program<AccessControl>;
export const vaultProgram = workspace.TokenizedVault as Program<TokenizedVault>;
export const strategyProgram = workspace.Strategy as Program<Strategy>;
export const accountantProgram = workspace.Accountant as Program<Accountant>;

export async function mochaGlobalSetup() {
  console.log("-------Global Setup Started-------");
  configOwner = anchor.web3.Keypair.generate();
  console.log("Super Admin public key:", configOwner.publicKey.toBase58());

  await airdrop({
    connection,
    publicKey: configOwner.publicKey,
    amount: 100e9,
  });

  await accessControlProgram.methods
    .initialize()
    .accounts({
      admin: configOwner.publicKey,
    })
    .signers([configOwner])
    .rpc();

  const config = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    accessControlProgram.programId
  )[0];

  const roleManagerRolesAdminRole =
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("role_manager"), ROLES_BUFFER.ROLES_ADMIN],
      accessControlProgram.programId
    )[0];

  const configOwnerRolesAdminRole = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_role"),
      configOwner.publicKey.toBuffer(),
      ROLES_BUFFER.ROLES_ADMIN,
    ],
    accessControlProgram.programId
  )[0];

  const configAccount = await accessControlProgram.account.config.fetch(config);

  const roleManageRolesAdminRoleAccount =
    await accessControlProgram.account.roleManager.fetch(
      roleManagerRolesAdminRole
    );

  const configOwnerRolesAdminRoleAccount =
    await accessControlProgram.account.userRole.fetch(configOwnerRolesAdminRole);

  assert.equal(configAccount.owner.toString(), configOwner.publicKey.toString());
  assert.equal(
    Number(roleManageRolesAdminRoleAccount.managerRoleId),
    Number(ROLES.ROLES_ADMIN)
  );
  assert.isTrue(configOwnerRolesAdminRoleAccount.hasRole);

  console.log(
    "Access Control program and Super Admin initialized successfully"
  );
  console.log("-------Global Setup Finished-------");
}
