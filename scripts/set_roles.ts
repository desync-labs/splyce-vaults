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

        const secretKeyPath = path.resolve(process.env.HOME, '.config/solana/mainnet.json');
        const secretKeyString = fs.readFileSync(secretKeyPath, 'utf8');
        const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
        const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

        const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;

        const rolesAdmin = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("roles_admin")],
            vaultProgram.programId,
        )[0];
        const accountRoles = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("roles"), admin.publicKey.toBuffer()],
            vaultProgram.programId,
        )[0];

        // Initialize the anchor workspace
        await vaultProgram.methods.initRoleAdmin()
            .accounts({
                admin: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        console.log("Roles admin:", rolesAdmin.toString());

        let vaultsAdmin = { vaultsAdmin: {} };
        await vaultProgram.methods.setRole(vaultsAdmin, admin.publicKey)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

          console.log("Vaults admin:", accountRoles.toString());

        let reportingManager = { reportingManager: {} };
        await vaultProgram.methods.setRole(reportingManager, admin.publicKey)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

          console.log("Reporting manager:", accountRoles.toString());
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

// Run the config function
main().catch((err) => {
    console.error(err);
    process.exit(1);
});