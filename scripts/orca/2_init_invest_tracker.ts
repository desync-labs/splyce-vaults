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

const TMAC_MINT = new PublicKey(
  "Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6"
);

const WHIRLPOOL_ID_for_WSOL = new PublicKey(
  "3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt"
);

const WHIRLPOOL_ID_for_TMAC = new PublicKey(
  "H3xhLrSEyDFm6jjG42QezbvhSxF5YHW75VdGUnqeEg5y"
);

const UNDERLYING_MINT = new PublicKey(
  "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k" //devUSDC
);

const USDT_MINT = new PublicKey("H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPm");
const SAMO_MINT = new PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa");

const WHIRLPOOL_ID_USDT = new PublicKey("63cMwvN8eoaD39os9bKP8brmA7Xtov9VxahnPufWCSdg");
const WHIRLPOOL_ID_SAMO = new PublicKey("EgxU92G34jw6QDG9RuTX9StFg1PmHuDqkRKAE5kVEiZ4");

const a_to_b_for_purchase_WSOL = false;
const a_to_b_for_purchase_TMAC = false;
const a_to_b_for_purchase_USDT = true;
const a_to_b_for_purchase_SAMO = false;

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

    // Derive user role PDA
    const [userRole] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_role"),
        admin.publicKey.toBuffer(),
        Buffer.from("strategies_manager")
      ],
      accessControlProgram.programId
    );

    // Initialize invest trackers for WSOL
    const [investTrackerWSOL] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("invest_tracker"),
        WSOL_MINT.toBuffer(),
        strategy.toBuffer()
      ],
      strategyProgram.programId
    );

    await strategyProgram.methods
      .initInvestTracker(a_to_b_for_purchase_WSOL, 2500)
      .accounts({
        strategy: strategy,
        assetMint: WSOL_MINT,
        signer: admin.publicKey,
        whirlpool: WHIRLPOOL_ID_for_WSOL,
        underlyingMint: UNDERLYING_MINT,
      })
      .signers([admin])
      .rpc();

    console.log(`Invest tracker initialized successfully for WSOL`);

    // Fetch and log WSOL invest tracker data
    const wsolTrackerAccount = await strategyProgram.account.investTracker.fetch(investTrackerWSOL);
    console.log("WSOL Invest Tracker Data:", {
      whirlpoolId: wsolTrackerAccount.whirlpoolId.toString(),
      assetMint: wsolTrackerAccount.assetMint.toString(),
      amountInvested: wsolTrackerAccount.amountInvested.toString(),
      amountWithdrawn: wsolTrackerAccount.amountWithdrawn.toString(),
      assetAmount: wsolTrackerAccount.assetAmount.toString(),
      assetPrice: wsolTrackerAccount.assetPrice.toString(),
      sqrtPrice: wsolTrackerAccount.sqrtPrice.toString(),
      assetValue: wsolTrackerAccount.assetValue.toString(),
      assetDecimals: wsolTrackerAccount.assetDecimals,
      underlyingDecimals: wsolTrackerAccount.underlyingDecimals,
      aToBForPurchase: wsolTrackerAccount.aToBForPurchase,
      assignedWeight: wsolTrackerAccount.assignedWeight,
      currentWeight: wsolTrackerAccount.currentWeight
    });

    // Initialize invest trackers for TMAC
    const [investTrackerTMAC] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("invest_tracker"),
        TMAC_MINT.toBuffer(),
        strategy.toBuffer()
      ],
      strategyProgram.programId
    );

    await strategyProgram.methods
      .initInvestTracker(a_to_b_for_purchase_TMAC, 2500)
      .accounts({
        strategy: strategy,
        assetMint: TMAC_MINT,
        signer: admin.publicKey,
        whirlpool: WHIRLPOOL_ID_for_TMAC,
        underlyingMint: UNDERLYING_MINT,
      })
      .signers([admin])
      .rpc();

    console.log(`Invest tracker initialized successfully for TMAC`);

    // Fetch and log TMAC invest tracker data
    const tmacTrackerAccount = await strategyProgram.account.investTracker.fetch(investTrackerTMAC);
    console.log("TMAC Invest Tracker Data:", {
      whirlpoolId: tmacTrackerAccount.whirlpoolId.toString(),
      assetMint: tmacTrackerAccount.assetMint.toString(),
      amountInvested: tmacTrackerAccount.amountInvested.toString(),
      amountWithdrawn: tmacTrackerAccount.amountWithdrawn.toString(),
      assetAmount: tmacTrackerAccount.assetAmount.toString(),
      assetPrice: tmacTrackerAccount.assetPrice.toString(),
      sqrtPrice: tmacTrackerAccount.sqrtPrice.toString(),
      assetValue: tmacTrackerAccount.assetValue.toString(),
      assetDecimals: tmacTrackerAccount.assetDecimals,
      underlyingDecimals: tmacTrackerAccount.underlyingDecimals,
      aToBForPurchase: tmacTrackerAccount.aToBForPurchase,
      assignedWeight: tmacTrackerAccount.assignedWeight,
      currentWeight: tmacTrackerAccount.currentWeight
    });

    // Initialize invest tracker for USDT
    await strategyProgram.methods
      .initInvestTracker(
        a_to_b_for_purchase_USDT, // a_to_b_for_purchase for USDT
        2500
      )
      .accounts({
        strategy: strategy,
        underlyingMint: UNDERLYING_MINT,
        assetMint: USDT_MINT,
        whirlpool: WHIRLPOOL_ID_USDT,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Invest tracker initialized successfully for USDT");

    // Initialize invest tracker for SAMO
    await strategyProgram.methods
      .initInvestTracker(
        a_to_b_for_purchase_SAMO, // a_to_b_for_purchase for SAMO
        2500
      )
      .accounts({
        strategy: strategy,
        underlyingMint: UNDERLYING_MINT,
        assetMint: SAMO_MINT,
        whirlpool: WHIRLPOOL_ID_SAMO,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Invest tracker initialized successfully for SAMO");

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});