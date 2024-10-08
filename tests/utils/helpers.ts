import * as anchor from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { BN, web3 } from "@coral-xyz/anchor";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";
import { StrategyProgram } from "../../target/types/strategy_program";
import { SimpleStrategyConfigSchema } from "./schemas";
import * as borsh from "borsh";

const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);
const METADATA_SEED = "metadata";

export const airdrop = async ({
  connection,
  publicKey,
  amount,
}: {
  connection: anchor.web3.Connection;
  publicKey: anchor.web3.PublicKey;
  amount: number;
}) => {
  const latestBlockHash = await connection.getLatestBlockhash();
  const airdropSignature = await connection.requestAirdrop(publicKey, amount);
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: airdropSignature,
  });
};

export const initializeVault = async ({
  vaultProgram,
  underlyingMint,
  vaultIndex,
  signer,
  config,
}: {
  vaultProgram: anchor.Program<TokenizedVault>;
  underlyingMint: anchor.web3.PublicKey;
  vaultIndex: number;
  signer: anchor.web3.Keypair;
  config: any;
}) => {
  const vault = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      Buffer.from(
        new Uint8Array(new BigUint64Array([BigInt(vaultIndex)]).buffer)
      ),
    ],
    vaultProgram.programId
  )[0];

  const sharesMint = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("shares"), vault.toBuffer()],
    vaultProgram.programId
  )[0];

  const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      sharesMint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const vaultTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("underlying"), vault.toBuffer()],
    vaultProgram.programId
  )[0];

  await vaultProgram.methods
    .initVault(new BN(vaultIndex), config)
    .accounts({
      metadata: metadataAddress,
      underlyingMint,
      signer: signer.publicKey,
    })
    .signers([signer])
    .rpc();

  return [vault, sharesMint, metadataAddress, vaultTokenAccount];
};

export const initializeSimpleStrategy = async ({
  strategyProgram,
  vault,
  underlyingMint,
  signer,
  index,
  config,
}: {
  strategyProgram: anchor.Program<StrategyProgram>;
  vault: anchor.web3.PublicKey;
  underlyingMint: anchor.web3.PublicKey;
  signer: anchor.web3.Keypair;
  index: number;
  config: any;
}) => {
  const strategy = anchor.web3.PublicKey.findProgramAddressSync(
    [vault.toBuffer(), Buffer.from(new Uint8Array([index]))],
    strategyProgram.programId
  )[0];

  const strategyTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("underlying"), strategy.toBuffer()],
    strategyProgram.programId
  )[0];

  const strategyType = { simple: {} };

  const configBytes = Buffer.from(
    borsh.serialize(SimpleStrategyConfigSchema, config)
  );

  await strategyProgram.methods
    .initStrategy(index, strategyType, configBytes)
    .accounts({
      vault,
      signer: signer.publicKey,
      underlyingMint,
      // @ts-ignore
      tokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .signers([signer])
    .rpc();

  return [strategy, strategyTokenAccount];
};
