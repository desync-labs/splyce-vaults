import * as anchor from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { BN, web3 } from "@coral-xyz/anchor";
import { Strategy } from "../../target/types/strategy";
import { SimpleStrategyConfigSchema } from "./schemas";
import * as borsh from "borsh";
import {
  METADATA_SEED,
  TOKEN_METADATA_PROGRAM_ID,
} from "../integration/setups/globalSetup";
import * as token from "@solana/spl-token";

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
  signer,
  vaultConfig,
  sharesConfig,
}: {
  vaultProgram: anchor.Program<TokenizedVault>;
  underlyingMint: anchor.web3.PublicKey;
  signer: anchor.web3.Keypair;
  vaultConfig: any;
  sharesConfig: any;
}) => {
  const config = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    vaultProgram.programId
  )[0];

  let configAccount = await vaultProgram.account.config.fetch(config);

  const nextVaultIndex = configAccount.nextVaultIndex.toNumber();

  const vault = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      Buffer.from(
        new Uint8Array(new BigUint64Array([BigInt(nextVaultIndex)]).buffer)
      ),
    ],
    vaultProgram.programId
  )[0];

  const sharesMint = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("shares"), vault.toBuffer()],
    vaultProgram.programId
  )[0];

  const vaultTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("underlying"), vault.toBuffer()],
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

  await vaultProgram.methods
    .initVault(vaultConfig)
    .accounts({
      underlyingMint,
      signer: signer.publicKey,
      tokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .signers([signer])
    .rpc();

  await vaultProgram.methods
    .initVaultShares(new BN(nextVaultIndex), sharesConfig)
    .accounts({
      metadata: metadataAddress,
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
  config,
}: {
  strategyProgram: anchor.Program<Strategy>;
  vault: anchor.web3.PublicKey;
  underlyingMint: anchor.web3.PublicKey;
  signer: anchor.web3.Keypair;
  config: any;
}) => {
  const globalStrategyConfig = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    strategyProgram.programId
  )[0];

  let configAccount = await strategyProgram.account.config.fetch(
    globalStrategyConfig
  );
  const nextStrategyIndex = configAccount.nextStrategyIndex.toNumber();

  const strategy = web3.PublicKey.findProgramAddressSync(
    [
      vault.toBuffer(),
      Buffer.from(
        new Uint8Array(new BigUint64Array([BigInt(nextStrategyIndex)]).buffer)
      ),
    ],
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
    .initStrategy(strategyType, configBytes)
    .accounts({
      vault,
      signer: signer.publicKey,
      underlyingMint,
      tokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .signers([signer])
    .rpc();

  return [strategy, strategyTokenAccount];
};
