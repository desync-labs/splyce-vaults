import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../target/types/tokenized_vault";
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

        // Initialize the anchor workspace
        await vaultProgram.methods.initialize()
            .accounts({
                admin: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        console.log("Initialized");
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

// Run the config function
main().catch((err) => {
    console.error(err);
    process.exit(1);
});