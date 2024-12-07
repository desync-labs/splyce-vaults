import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Strategy } from "../../target/types/strategy";
import { AccessControl } from "../../target/types/access_control";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import * as fs from "fs";
import * as path from "path";
import { PublicKey } from "@solana/web3.js";

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
        new anchor.BN(0).toArrayLike(Buffer, 'le', 8)
      ],
      strategyProgram.programId
    );

    console.log("Strategy PDA:", strategy.toBase58());

    // Get invest tracker PDAs
    const [INVEST_TRACKER_ACCOUNT_WSOL] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), WSOL_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );
    console.log("Invest Tracker WSOL address:", INVEST_TRACKER_ACCOUNT_WSOL.toBase58());

    const [INVEST_TRACKER_ACCOUNT_TMAC] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), TMAC_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );
    console.log("Invest Tracker TMAC address:", INVEST_TRACKER_ACCOUNT_TMAC.toBase58());

    // Log invest tracker states before update
    console.log("\nInvest Tracker States BEFORE update:");
    const tmacTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_TMAC);
    const wsolTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);

    // Build remaining accounts for update
    const remainingAccounts = [
      {
        pubkey: INVEST_TRACKER_ACCOUNT_WSOL,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: WHIRLPOOL_ID_for_WSOL,
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: INVEST_TRACKER_ACCOUNT_TMAC,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: WHIRLPOOL_ID_for_TMAC,
        isWritable: false,
        isSigner: false,
      },
    ];

    // Call update_invest_trackers
    await strategyProgram.methods
      .updateInvestTrackers()
      .accounts({
        signer: admin.publicKey,
      })
      .remainingAccounts(remainingAccounts)
      .signers([admin])
      .rpc();

    console.log("Invest trackers updated successfully");

    // Log invest tracker states after update
    console.log("\nInvest Tracker States AFTER update:");
    const tmacTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_TMAC);
    const wsolTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);

    // Log changes for WSOL tracker
    console.log("\nWSOL Tracker Changes:");
    console.log({
      assetPrice: {
        before: wsolTrackerBefore.assetPrice.toString(),
        after: wsolTrackerAfter.assetPrice.toString(),
      },
      assetValue: {
        before: wsolTrackerBefore.assetValue.toString(),
        after: wsolTrackerAfter.assetValue.toString(),
      },
      currentWeight: {
        before: wsolTrackerBefore.currentWeight,
        after: wsolTrackerAfter.currentWeight,
      }
    });

    // Log changes for TMAC tracker
    console.log("\nTMAC Tracker Changes:");
    console.log({
      assetPrice: {
        before: tmacTrackerBefore.assetPrice.toString(),
        after: tmacTrackerAfter.assetPrice.toString(),
      },
      assetValue: {
        before: tmacTrackerBefore.assetValue.toString(),
        after: tmacTrackerAfter.assetValue.toString(),
      },
      currentWeight: {
        before: tmacTrackerBefore.currentWeight,
        after: tmacTrackerAfter.currentWeight,
      }
    });

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
