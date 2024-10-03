import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../target/types/tokenized_vault";
import { StrategyProgram } from "../target/types/strategy_program";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as borsh from 'borsh';
import { SimpleStrategy, SimpleStrategySchema } from "../tests/utils/schemas";
import * as fs from 'fs'; // Import fs module
import * as path from 'path'; // Import path module

// Define the config function
async function main() {
    try {
        const provider = anchor.AnchorProvider.env();
        anchor.setProvider(provider);

        const secretKeyPath = path.resolve(process.env.HOME, '.config/solana/id.json');
        const secretKeyString = fs.readFileSync(secretKeyPath, 'utf8');
        const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
        const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

        const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
        const strategyProgram = anchor.workspace.StrategyProgram as Program<StrategyProgram>;

        const underlyingMint = await token.createMint(provider.connection, admin, admin.publicKey, null, 9);
        console.log("Underlying token mint public key:", underlyingMint.toBase58());

        const vault = anchor.web3.PublicKey.findProgramAddressSync(
            [
              Buffer.from("vault"),
              Buffer.from(new Uint8Array(new BigUint64Array([BigInt(0)]).buffer))
            ],
            vaultProgram.programId
          )[0];
      
        const config = {
            depositLimit: new BN(1000000000),
            minUserDeposit: new BN(0),
            performanceFee: new BN(1000),
            profitMaxUnlockTime: new BN(0),
          };

        await vaultProgram.methods.initVault(new BN(0), config)
          .accounts({
            underlyingMint,
            signer: admin.publicKey,
            tokenProgram: token.TOKEN_PROGRAM_ID,
          })
          .signers([admin])
          .rpc();
    
        console.log("Vault:", vault.toBase58());

        const strategy = anchor.web3.PublicKey.findProgramAddressSync(
          [
            vault.toBuffer(),
            Buffer.from(new Uint8Array([0]))
          ],
          strategyProgram.programId
        )[0];
    
        const strategyType = { simple: {} };
        const strategyConfig = new SimpleStrategy({
          depositLimit: new BN(1000),
          performanceFee: new BN(0),
          feeManager: admin.publicKey,
        });

        const configBytes = Buffer.from(borsh.serialize(SimpleStrategySchema, strategyConfig));
        await strategyProgram.methods.initStrategy(0, strategyType, configBytes)
          .accounts({
            vault,
            underlyingMint,
            signer: admin.publicKey,
          })
          .signers([admin])
          .rpc();

        console.log("Strategy:", strategy.toBase58());

      await vaultProgram.methods.addStrategy(new BN(1000000000))
        .accounts({
          vault,
          strategy,
          signer: admin.publicKey,
        })
        .signers([admin])
        .rpc();

        console.log("Strategy added to vault");
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

// Run the config function
main().catch((err) => {
    console.error(err);
    process.exit(1);
});