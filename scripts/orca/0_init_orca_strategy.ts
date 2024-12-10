import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { Strategy } from "../../target/types/strategy";
import { OrcaStrategyConfig, OrcaStrategyConfigSchema } from "../../tests/utils/schemas";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import * as borsh from 'borsh';
import * as fs from 'fs';
import * as path from 'path';
import { AccessControl } from "../../target/types/access_control";

const METADATA_SEED = "metadata";
const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
// devUSDC on devnet
const underlyingMint = new anchor.web3.PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k");
async function main() {
  try {
    // 1. Setup Provider and Programs
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
    const strategyProgram = anchor.workspace.Strategy as Program<Strategy>;
    const accessControlProgram = anchor.workspace.AccessControl as Program<AccessControl>;

    // 2. Load Admin Keypair
    const secretKeyPath = path.resolve(process.env.HOME, '.config/solana/id.json');
    const secretKeyString = fs.readFileSync(secretKeyPath, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

    console.log("Admin Public Key:", admin.publicKey.toBase58());
    console.log("Vault Program ID:", vaultProgram.programId.toBase58());
    console.log("Strategy Program ID:", strategyProgram.programId.toBase58());
    console.log("Access Control Program ID:", accessControlProgram.programId.toBase58());

    // 3. Initialize Access Control
    console.log("Initializing Access Control...");
    await accessControlProgram.methods.initialize()
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Access Control initialized.");

    // 4. Define Roles
    const ROLES = {
      ROLES_ADMIN: new BN(0),
      VAULTS_ADMIN: new BN(1),
      REPORTING_MANAGER: new BN(2),
      STRATEGIES_MANAGER: new BN(3),
      ACCOUNTANT_ADMIN: new BN(4),
      KYC_PROVIDER: new BN(5),
      KYC_VERIFIED: new BN(6),
    };

    // 5. Set Role Managers
    console.log("Setting Role Managers...");
    await accessControlProgram.methods.setRoleManager(ROLES.VAULTS_ADMIN, ROLES.ROLES_ADMIN)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Vaults Admin Role Manager set.");

    await accessControlProgram.methods.setRoleManager(ROLES.REPORTING_MANAGER, ROLES.ROLES_ADMIN)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Reporting Manager Role Manager set.");

    await accessControlProgram.methods.setRoleManager(ROLES.STRATEGIES_MANAGER, ROLES.ROLES_ADMIN)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Strategies Manager Role Manager set.");

    await accessControlProgram.methods.setRoleManager(ROLES.ACCOUNTANT_ADMIN, ROLES.ROLES_ADMIN)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Accountant Admin Role Manager set.");

    await accessControlProgram.methods.setRoleManager(ROLES.KYC_PROVIDER, ROLES.ROLES_ADMIN)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("KYC Provider Role Manager set.");

    await accessControlProgram.methods.setRoleManager(ROLES.KYC_VERIFIED, ROLES.KYC_PROVIDER)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("KYC Verified Role Manager set.");

    // 6. Assign Roles to Admin
    console.log("Assigning Roles to Admin...");
    await accessControlProgram.methods.setRole(ROLES.VAULTS_ADMIN, admin.publicKey)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Vaults Admin role assigned to Admin.");

    await accessControlProgram.methods.setRole(ROLES.REPORTING_MANAGER, admin.publicKey)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Reporting Manager role assigned to Admin.");

    await accessControlProgram.methods.setRole(ROLES.STRATEGIES_MANAGER, admin.publicKey)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Strategies Manager role assigned to Admin.");

    await accessControlProgram.methods.setRole(ROLES.ACCOUNTANT_ADMIN, admin.publicKey)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Accountant Admin role assigned to Admin.");

    // 7. Initialize Vault Config
    console.log("Initializing Vault Config...");
    const configPDA = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("CONFIG_SEED")],
      vaultProgram.programId
    )[0];

    // Try to initialize the config account
    try {
      console.log("Creating config account");
      await vaultProgram.methods.initialize()
        .accounts({
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();
      console.log("Config account initialized");
    } catch (error) {
      console.log("Config account might already exist, continuing...");
    }

    // Simplify the config fetching logic for first vault
    const vaultIndex = 0; // First vault
    console.log("Using Vault Index:", vaultIndex);

    let vault = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(vaultIndex)]).buffer))
      ],
      vaultProgram.programId
    )[0];
    console.log("Vault PDA:", vault.toBase58());

    let sharesMint = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vault.toBuffer()],
      vaultProgram.programId
    )[0];
    
    // 8. Derive Metadata PDA for Vault Shares
    const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        sharesMint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log("Metadata Address:", metadataAddress.toBase58());

    // Update the vaultConfig object to match the expected structure
    const vaultConfig = {
        depositLimit: new BN(1000000000000), // Adjust value as needed
        minUserDeposit: new BN(1000000),     // Adjust value as needed
        accountant: admin.publicKey,          // Using admin as accountant
        profitMaxUnlockTime: new BN(7 * 24 * 60 * 60), // 7 days in seconds
        kycVerifiedOnly: false,
        directDepositEnabled: true,
        whitelistedOnly: true,
    };

    // 9. Initialize Vault
    await vaultProgram.methods.initVault(vaultConfig)
      .accounts({
        underlyingMint,
        signer: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();
    console.log("Vault initialized.");

    // Whitelist admin for vault operations
    await vaultProgram.methods.whitelist(admin.publicKey)
      .accounts({
        vault: vault,
      })
      .signers([admin])
      .rpc();

    console.log("Admin whitelisted for vault operations");

    // 10. Initialize Vault Shares
    const sharesConfig = {
      name: "Orca Strategy Vault Shares",
      symbol: "OSV",
      uri: "YOUR_SHARES_METADATA_URI", // Replace with actual URI
    };
    await vaultProgram.methods.initVaultShares(new BN(vaultIndex), sharesConfig)
      .accounts({
        metadata: metadataAddress,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Vault Shares initialized.");

    // 12. Define Strategy Configuration
    const strategyType = { orca: {} };
    const strategyConfig = new OrcaStrategyConfig({
      depositLimit: new BN(1_000_000_000),
      depositPeriodEnds: new BN(Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)), // 1 year from now
      lockPeriodEnds: new BN(Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)), // 1 week from now
      performanceFee: new BN(50),
      feeManager: admin.publicKey,
    });

    // 13. Serialize Strategy Configuration
    const configBytes = Buffer.from(borsh.serialize(OrcaStrategyConfigSchema, strategyConfig));
    console.log("Strategy Config Bytes:", configBytes);

    // 14. Initialize Strategy
    const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
      [vault.toBuffer(), 
        new BN(0).toArrayLike(Buffer, 'le', 8)
      ],
      strategyProgram.programId
    );
    console.log("Strategy PDA:", strategy.toBase58());

    const [tokenAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), strategy.toBuffer()],
      strategyProgram.programId
    );

    const [config] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      strategyProgram.programId
    );

    const [roles] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_role"),
        admin.publicKey.toBuffer(),
        Buffer.from([3]) // Role::StrategiesManager = 3
      ],
      accessControlProgram.programId
    );

    // Initialize Strategy Program
    console.log("Initializing Strategy Program Config...");
    await strategyProgram.methods.initialize()
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Strategy Program Config initialized.");

    // Initialize Strategy Program Config
    await strategyProgram.methods.initStrategy(strategyType, configBytes)
      .accounts({
        underlyingMint,
        vault,
        signer: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();
    console.log("Strategy initialized.");

    // 15. Add Strategy to Vault
    await vaultProgram.methods.addStrategy(new BN(1000000000))
      .accounts({
        vault,
        strategy,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    console.log("Strategy added to Vault.");
    

    // 16. Final Logs
    console.log("Initialization complete!");
    console.log("Vault Address:", vault.toBase58());
    console.log("Strategy Address:", strategy.toBase58());

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});