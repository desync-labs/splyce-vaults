import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../target/types/tokenized_vault";
import * as fs from 'fs'; // Import fs module
import * as path from 'path'; // Import path module
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";


// Define the config function
async function main() {
    try {
        const provider = anchor.AnchorProvider.env();

        const secretKeyPath = path.resolve(process.env.HOME, '.config/solana/id.json');
        const secretKeyString = fs.readFileSync(secretKeyPath, 'utf8');
        const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
        const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

        const underlyingMint = await token.createMint(provider.connection, admin, admin.publicKey, null, 9);
        console.log("Underlying token mint public key:", underlyingMint.toBase58());
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

// Run the config function
main().catch((err) => {
    console.error(err);
    process.exit(1);
});