import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Strategy } from "../../target/types/strategy";
import { AccessControl } from "../../target/types/access_control";
import { TokenizedVault } from "../../target/types/tokenized_vault";
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
    const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;

    console.log("Strategy Program ID:", strategyProgram.programId.toBase58());
    console.log("Access Control Program ID:", accessControlProgram.programId.toBase58());
    console.log("Vault Program ID:", vaultProgram.programId.toBase58());

    // Derive strategy PDA (using index 0)
    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        new anchor.BN(0).toArrayLike(Buffer, 'le', 8)
      ],
      vaultProgram.programId
    );

    const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
      [vaultPDA.toBuffer(), 
        new anchor.BN(0).toArrayLike(Buffer, 'le', 8)
      ],
      strategyProgram.programId
    );

    // Initialize token account for WSOL
    await strategyProgram.methods
      .initTokenAccount()
      .accounts({
        strategy: strategy,
        assetMint: WSOL_MINT,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Token account initialized successfully for WSOL");

    const TMAC_MINT = new PublicKey(
      "Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6"
    );
    // Initialize token account for TMAC
    await strategyProgram.methods
      .initTokenAccount()
      .accounts({
          strategy: strategy,
          assetMint: TMAC_MINT,
          signer: admin.publicKey,
        })
        .signers([admin])
        .rpc();
  
    console.log("Token account initialized successfully for TMAC");

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});