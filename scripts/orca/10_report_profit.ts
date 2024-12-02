import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Strategy } from "../../target/types/strategy";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { AccessControl } from "../../target/types/access_control";
import { BN } from "@coral-xyz/anchor";
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
const USDC_MINT = new PublicKey(
  "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"
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
    const strategyProgram = anchor.workspace.Strategy as Program<Strategy>;
    const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;

    // Get vault PDA
    const vaultIndex = 0;
    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(vaultIndex)]).buffer))
      ],
      vaultProgram.programId
    );

    // Get strategy PDA
    const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        vaultPDA.toBuffer(),
        new BN(0).toArrayLike(Buffer, 'le', 8)
      ],
      strategyProgram.programId
    );

    // Get strategy token accounts
    const [strategyWSOLAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_account"),
        WSOL_MINT.toBuffer(),
        strategy.toBuffer(),
      ],
      strategyProgram.programId
    );

    const [strategyTMACAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_account"),
        TMAC_MINT.toBuffer(),
        strategy.toBuffer(),
      ],
      strategyProgram.programId
    );

    const [strategyTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), strategy.toBuffer()],
      strategyProgram.programId
    );

    // Get invest tracker PDAs
    const [INVEST_TRACKER_ACCOUNT_WSOL] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("invest_tracker"),
        WSOL_MINT.toBuffer(),
        strategy.toBuffer(),
      ],
      strategyProgram.programId
    );

    const [INVEST_TRACKER_ACCOUNT_TMAC] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("invest_tracker"),
        TMAC_MINT.toBuffer(),
        strategy.toBuffer(),
      ],
      strategyProgram.programId
    );

    // Log initial states
    console.log("\nInitial States:");
    const wsolBalanceBefore = await provider.connection.getTokenAccountBalance(strategyWSOLAccount);
    const tmacBalanceBefore = await provider.connection.getTokenAccountBalance(strategyTMACAccount);
    const usdcBalanceBefore = await provider.connection.getTokenAccountBalance(strategyTokenAccount);
    
    console.log("WSOL Balance:", wsolBalanceBefore.value.uiAmount);
    console.log("TMAC Balance:", tmacBalanceBefore.value.uiAmount);
    console.log("USDC Balance:", usdcBalanceBefore.value.uiAmount);

    const wsolTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);
    const tmacTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_TMAC);

    console.log("\nInvest Tracker States BEFORE report:");
    console.log("WSOL Tracker:", {
      assetValue: wsolTrackerBefore.assetValue.toString(),
      currentWeight: wsolTrackerBefore.currentWeight,
    });
    console.log("TMAC Tracker:", {
      assetValue: tmacTrackerBefore.assetValue.toString(),
      currentWeight: tmacTrackerBefore.currentWeight,
    });

    // Call report_profit
    await strategyProgram.methods
      .reportProfit(new BN(0)) // profit amount is calculated inside harvest_and_report
      .accounts({
        strategy,
        signer: admin.publicKey,
      })
      .remainingAccounts([
        // First pair: WSOL invest tracker and mint
        {
          pubkey: INVEST_TRACKER_ACCOUNT_WSOL,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: WSOL_MINT,
          isWritable: false,
          isSigner: false,
        },
        // Second pair: TMAC invest tracker and mint
        {
          pubkey: INVEST_TRACKER_ACCOUNT_TMAC,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: TMAC_MINT,
          isWritable: false,
          isSigner: false,
        },
      ])
      .signers([admin])
      .rpc();

    console.log("\nReport profit completed successfully!");

    // Log final states
    const wsolBalanceAfter = await provider.connection.getTokenAccountBalance(strategyWSOLAccount);
    const tmacBalanceAfter = await provider.connection.getTokenAccountBalance(strategyTMACAccount);
    const usdcBalanceAfter = await provider.connection.getTokenAccountBalance(strategyTokenAccount);
    
    console.log("\nFinal States:");
    console.log("WSOL Balance:", wsolBalanceAfter.value.uiAmount);
    console.log("TMAC Balance:", tmacBalanceAfter.value.uiAmount);
    console.log("USDC Balance:", usdcBalanceAfter.value.uiAmount);

    const wsolTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);
    const tmacTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_TMAC);

    console.log("\nInvest Tracker States AFTER report:");
    console.log("WSOL Tracker:", {
      assetValue: wsolTrackerAfter.assetValue.toString(),
      currentWeight: wsolTrackerAfter.currentWeight,
    });
    console.log("TMAC Tracker:", {
      assetValue: tmacTrackerAfter.assetValue.toString(),
      currentWeight: tmacTrackerAfter.currentWeight,
    });

    // Log changes
    console.log("\nChanges:");
    console.log("WSOL asset value change:", 
      (wsolTrackerAfter.assetValue.sub(wsolTrackerBefore.assetValue)).toString()
    );
    console.log("TMAC asset value change:", 
      (tmacTrackerAfter.assetValue.sub(tmacTrackerBefore.assetValue)).toString()
    );

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
