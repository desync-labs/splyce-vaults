import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AccessControl } from "../target/types/access_control";
import * as fs from 'fs'; // Import fs module
import * as path from 'path'; // Import path module

const ROLES = {
    ROLES_ADMIN: new BN(0),
    VAULTS_ADMIN: new BN(1),
    REPORTING_MANAGER: new BN(2),
    STRATEGIES_MANAGER: new BN(3),
    ACCOUNTANT_ADMIN: new BN(4),
    KYC_PROVIDER: new BN(5),
    KYC_VERIFIED: new BN(6),
}

// Define the config function
async function main() {
    try {
        const provider = anchor.AnchorProvider.env();
        anchor.setProvider(provider);

        const secretKeyPath = path.resolve(process.env.HOME, '.config/solana/id.json');
        const secretKeyString = fs.readFileSync(secretKeyPath, 'utf8');
        const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
        const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

        const accessControlProgram = anchor.workspace.AccessControl as Program<AccessControl>;

        await accessControlProgram.methods.setRoleManager(ROLES.VAULTS_ADMIN, ROLES.ROLES_ADMIN)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        await accessControlProgram.methods.setRoleManager(ROLES.STRATEGIES_MANAGER, ROLES.ROLES_ADMIN)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        await accessControlProgram.methods.setRoleManager(ROLES.REPORTING_MANAGER, ROLES.ROLES_ADMIN)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        await accessControlProgram.methods.setRoleManager(ROLES.ACCOUNTANT_ADMIN, ROLES.ROLES_ADMIN)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        await accessControlProgram.methods.setRoleManager(ROLES.KYC_PROVIDER, ROLES.ROLES_ADMIN)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        await accessControlProgram.methods.setRoleManager(ROLES.KYC_VERIFIED, ROLES.KYC_PROVIDER)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        console.log("Roles manages set");

        await accessControlProgram.methods.setRole(ROLES.VAULTS_ADMIN, admin.publicKey)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        console.log("Vaults admin: ", admin.publicKey.toBase58());

        await accessControlProgram.methods.setRole(ROLES.STRATEGIES_MANAGER, admin.publicKey)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        console.log("Strategies manager: ", admin.publicKey.toBase58());

        await accessControlProgram.methods.setRole(ROLES.REPORTING_MANAGER, admin.publicKey)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        console.log("Reporting manager: ", admin.publicKey.toBase58());

        await accessControlProgram.methods.setRole(ROLES.ACCOUNTANT_ADMIN, admin.publicKey)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        console.log("Accountant admin: ", admin.publicKey.toBase58());

        await accessControlProgram.methods.setRole(ROLES.KYC_PROVIDER, admin.publicKey)
            .accounts({
                signer: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        console.log("KYC provider: ", admin.publicKey.toBase58());
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

// Run the config function
main().catch((err) => {
    console.error(err);
    process.exit(1);
});