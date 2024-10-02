import * as anchor from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { BN } from "@coral-xyz/anchor";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";
import { StrategyProgram } from "../../target/types/strategy_program";
import { SimpleStrategy, SimpleStrategySchema } from "./schemas";
import * as borsh from "borsh";

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
}: {
  vaultProgram: anchor.Program<TokenizedVault>;
  underlyingMint: anchor.web3.PublicKey;
  vaultIndex: number;
  signer: anchor.web3.Keypair;
}) => {
  const vault = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      underlyingMint.toBuffer(),
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

  const vaultTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("underlying"), vault.toBuffer()],
    vaultProgram.programId
  )[0];

  await vaultProgram.methods
    .initialize(new BN(vaultIndex))
    .accounts({
      underlyingMint,
      signer: signer.publicKey,
      tokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .signers([signer])
    .rpc();

  return [vault, sharesMint, vaultTokenAccount];
};

export const initializeSimpleStrategy = async ({
  strategyProgram,
  vault,
  underlyingMint,
  signer,
  depositLimit,
  performanceFee,
}: {
  strategyProgram: anchor.Program<StrategyProgram>;
  vault: anchor.web3.PublicKey;
  underlyingMint: anchor.web3.PublicKey;
  signer: anchor.web3.Keypair;
  depositLimit: number;
  performanceFee: number;
}) => {
  const strategy = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("simple"), vault.toBuffer()],
    strategyProgram.programId
  )[0];

  const strategyTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
    [strategy.toBuffer(), Buffer.from("underlying")],
    strategyProgram.programId
  )[0];

  const strategyType = { simple: {} };

  const config = new SimpleStrategy({
    depositLimit: new BN(depositLimit),
    performanceFee: new BN(performanceFee),
    // @ts-ignore
    feeManager: signer.publicKey.toBuffer(),
  });
  const configBytes = Buffer.from(
    borsh.serialize(SimpleStrategySchema, config)
  );
  await strategyProgram.methods
    .initialize(strategyType, configBytes)
    .accounts({
      // @ts-ignore
      strategy,
      underlyingMint,
      vault,
      signer: signer.publicKey,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([signer])
    .rpc();

  return [strategy, strategyTokenAccount];
};
