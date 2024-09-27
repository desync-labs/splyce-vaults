import * as anchor from "@coral-xyz/anchor";

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
