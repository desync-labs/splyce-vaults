import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../target/types/tokenized_vault";
import * as fs from 'fs'; 
import * as path from 'path'; 

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

        const vault_index = 2;

        const vault = anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from("vault"),
            Buffer.from(new Uint8Array(new BigUint64Array([BigInt(vault_index)]).buffer))
          ],
          vaultProgram.programId
        )[0];

        // const roles = anchor.web3.PublicKey.findProgramAddressSync(
        //     [Buffer.from("roles"), admin.publicKey.toBuffer()],
        //     vaultProgram.programId,
        // )[0];

        let vault_data = await vaultProgram.account.vault.fetch(vault);
        console.log('Before shutdown {#?}', vault_data);

        // Initialize the anchor workspace
        await vaultProgram.methods.shutdownVault()
            .accounts({
                vault,
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        console.log(`Vault ${vault.toBase58()} has been shutdown`);

        vault_data = await vaultProgram.account.vault.fetch(vault);
        console.log('Before shutdown {#?}', vault_data);

        
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

// Run the config function
main().catch((err) => {
    console.error(err);
    process.exit(1);
});