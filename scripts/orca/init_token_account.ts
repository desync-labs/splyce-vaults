import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Strategy } from "../../target/types/strategy";
import { AccessControl } from "../../target/types/access_control";
import * as fs from "fs";
import * as path from "path";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Token Mints
const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

async function main() {
  try {
    // Setup Provider and Programs
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // Load admin keypair
    const secretKeyPath = path.resolve(
      process.env.HOME!,
      ".config/solana/id.json"
    );
    const secretKeyString = fs.readFileSync(secretKeyPath, "utf8");
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

    console.log("Admin PublicKey:", admin.publicKey.toBase58());

    // Initialize programs
    const strategyProgram: Program<Strategy> = anchor.workspace.Strategy;
    const accessControlProgram = anchor.workspace.AccessControl as Program<AccessControl>;

    console.log("Strategy Program ID:", strategyProgram.programId.toBase58());
    console.log("Access Control Program ID:", accessControlProgram.programId.toBase58());

    // Derive strategy PDA (using index 0)
    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        new anchor.BN(0).toArrayLike(Buffer, 'le', 8)
      ],
      new PublicKey("vauJuqPqVgkbGxGKqvHwHmXRZaJLGtGYRoRKhCEfcpB") // Replace with your vault program ID
    );

    const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
      [vaultPDA.toBuffer(), 
        new anchor.BN(0).toArrayLike(Buffer, 'le', 8)
      ],
      strategyProgram.programId
    );

    // Get roles PDA
    const [roles] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_role"),
        admin.publicKey.toBuffer(),
        Buffer.from([2]) // Role::StrategiesManager = 2
      ],
      accessControlProgram.programId
    );

    // Initialize token account for WSOL
    await strategyProgram.methods
      .initTokenAccount()
      .accounts({
        strategy: strategy,
        tokenAccount: anchor.web3.PublicKey.findProgramAddressSync(
          [WSOL_MINT.toBuffer(), strategy.toBuffer()],
          strategyProgram.programId
        )[0],
        assetMint: WSOL_MINT,
        roles: roles,
        signer: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        accessControl: accessControlProgram.programId,
        strategyProgram: strategyProgram.programId,
      })
      .signers([admin])
      .rpc();

    console.log("Token account initialized successfully");

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});