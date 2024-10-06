import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../target/types/tokenized_vault";
import * as fs from 'fs'; // Import fs module
import * as path from 'path'; // Import path module
import { BN } from "@coral-xyz/anchor";
import { StrategyProgram } from "../target/types/strategy_program";
import * as token from "@solana/spl-token";

// Define the config function
async function main() {
    try {
        const provider = anchor.AnchorProvider.env();
        anchor.setProvider(provider);

        const secretKeyPath = path.resolve(process.env.HOME, '.config/solana/id.json');
        const secretKeyString = fs.readFileSync(secretKeyPath, 'utf8');
        const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
        const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

        const feeRecipient = anchor.web3.Keypair.generate();
        const airdropSignature = await provider.connection.requestAirdrop(feeRecipient.publicKey, 10e9);
        await provider.connection.confirmTransaction(airdropSignature);
    

        const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
        const strategyProgram = anchor.workspace.TokenizedVault as Program<StrategyProgram>;

        let vault = anchor.web3.PublicKey.findProgramAddressSync(
            [
              Buffer.from("vault"),
              Buffer.from(new Uint8Array(new BigUint64Array([BigInt(0)]).buffer))
            ],
            vaultProgram.programId
          )[0];

        console.log("Vault PDA:", vault.toBase58());
        
        const sharesMint = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("shares"), vault.toBuffer()],
            vaultProgram.programId
          )[0];


        console.log("1");

        const underlyingMint = new anchor.web3.PublicKey("H6RLQCTDbiJdNP1K8Cjoc5MAabaAq5fEdcpdJjSwuXB4");

        console.log("1.1");

        const feeRecipientSharesAccount = await token.createAccount(provider.connection, feeRecipient, sharesMint, feeRecipient.publicKey);
        // const feeRecipientTokenAccount = await token.createAccount(provider.connection, admin, underlyingMint, admin.publicKey);

        console.log("1.2");

        let strategy = anchor.web3.PublicKey.findProgramAddressSync(
            [
                vault.toBuffer(),
                Buffer.from(new Uint8Array([0]))
            ],
            strategyProgram.programId
            )[0];

            console.log("2");

        let strategyTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("underlying"), strategy.toBuffer()],
            strategyProgram.programId,
        )[0];

        console.log("3");
       
        await strategyProgram.methods.report()
        .accounts({
          strategy,
          tokenAccount: strategyTokenAccount,
          signer: admin.publicKey,
        })
        .remainingAccounts([
          { pubkey: strategyTokenAccount, isWritable: true, isSigner: false },
        ])
        .signers([admin])
        .rpc();

        console.log("4");
  
      await vaultProgram.methods.processReport()
        .accounts({
          vault,
          strategy,
          signer: admin.publicKey,
          feeSharesRecipient: feeRecipientSharesAccount,
        })
        .signers([admin])
        .rpc();
        
        console.log("5");

        //console.log("Updated depsotit limit to:", newDepositLimit.toString());
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

// Run the config function
main().catch((err) => {
    console.error(err);
    process.exit(1);
});