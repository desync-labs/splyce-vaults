import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StrategyProgram } from "../../../target/types/strategy_program";
import { TokenizedVault } from "../../../target/types/tokenized_vault";
import { airdrop } from "../../utils/helpers";
import { before } from "mocha";

anchor.setProvider(anchor.AnchorProvider.env());
const provider = anchor.AnchorProvider.env();
export const connection = provider.connection;
export let rolesAdmin: anchor.web3.Keypair;

export const vaultProgram = anchor.workspace
  .TokenizedVault as Program<TokenizedVault>;
export const strategyProgram = anchor.workspace
  .StrategyProgram as Program<StrategyProgram>;

export async function mochaGlobalSetup() {
  console.log("-------Global Setup Started-------");
  rolesAdmin = anchor.web3.Keypair.generate();
  console.log("Roles Admin public key:", rolesAdmin.publicKey.toBase58());

  await airdrop({
    connection,
    publicKey: rolesAdmin.publicKey,
    amount: 100e9,
  });

  // Init Roles Admin
  await vaultProgram.methods
    .initRoleAdmin()
    .accounts({
      admin: rolesAdmin.publicKey,
    })
    .signers([rolesAdmin])
    .rpc();

  console.log("Roles Admin initialized successfully");
  console.log("-------Global Setup Finished-------");
}
