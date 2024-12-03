import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { Strategy } from "../../target/types/strategy";
import { BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import { PublicKey } from "@solana/web3.js";

const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);
const TMAC_MINT = new PublicKey(
  "Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6"
);

function deserializeOrcaStrategy(data: Buffer) {
    // Skip 8 byte discriminator
    let offset = 8;

    // bump: [u8; 1]
    const bump = data.slice(offset, offset + 1);
    offset += 1;

    // index_bytes: [u8; 8]
    const indexBytes = data.slice(offset, offset + 8);
    offset += 8;

    // vault: Pubkey (32 bytes)
    const vault = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // manager: Pubkey (32 bytes)
    const manager = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // underlying_mint: Pubkey (32 bytes)
    const underlyingMint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // underlying_token_acc: Pubkey (32 bytes)
    const underlyingTokenAcc = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // underlying_decimals: u8
    const underlyingDecimals = data[offset];
    offset += 1;

    // total_invested: u64
    const totalInvested = data.readBigUInt64LE(offset);
    offset += 8;

    // total_assets: u64
    const totalAssets = data.readBigUInt64LE(offset);
    offset += 8;

    // deposit_limit: u64
    const depositLimit = data.readBigUInt64LE(offset);
    offset += 8;

    // fee_data will follow but we don't need it for now

    return {
        bump,
        indexBytes,
        vault,
        manager,
        underlyingMint,
        underlyingTokenAcc,
        underlyingDecimals,
        totalInvested,
        totalAssets,
        depositLimit
    };
}

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
    const secretKeyString = fs.readFileSync(secretKeyPath, { encoding: "utf-8" });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

    // Initialize Programs
    const tokenizedVaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
    const strategyProgram = anchor.workspace.Strategy as Program<Strategy>;

    // Get vault PDA
    const vaultIndex = 0;
    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(vaultIndex)]).buffer))
      ],
      tokenizedVaultProgram.programId
    );

    // Get strategy PDA
    const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        vaultPDA.toBuffer(),
        new BN(0).toArrayLike(Buffer, 'le', 8)
      ],
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

    // Get raw account data and deserialize strategy
    const strategyAccountInfo = await provider.connection.getAccountInfo(strategy);
    if (!strategyAccountInfo) {
      throw new Error("Strategy account not found");
    }

    // Log invest tracker states before report
    console.log("\nInvest Tracker States BEFORE report:");
    const tmacTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_TMAC);
    const wsolTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);
    
    console.log("TMAC Tracker:", {
      amount_invested: tmacTrackerBefore.amountInvested.toString(),
      amount_withdrawn: tmacTrackerBefore.amountWithdrawn.toString(),
      asset_amount: tmacTrackerBefore.assetAmount.toString(),
      asset_value: tmacTrackerBefore.assetValue.toString(),
    });
    
    console.log("WSOL Tracker:", {
      amount_invested: wsolTrackerBefore.amountInvested.toString(),
      amount_withdrawn: wsolTrackerBefore.amountWithdrawn.toString(),
      asset_amount: wsolTrackerBefore.assetAmount.toString(),
      asset_value: wsolTrackerBefore.assetValue.toString(),
    });

    // Deserialize and log strategy state
    const strategyBefore = deserializeOrcaStrategy(Buffer.from(strategyAccountInfo.data));
    console.log("\nStrategy State BEFORE report:");
    console.log("Total Assets:", strategyBefore.totalAssets.toString());
    console.log("Total Invested:", strategyBefore.totalInvested.toString());

    // Call report_profit with required remaining accounts
    await strategyProgram.methods
      .reportProfit(new BN(0))
      .accounts({
        strategy,
        signer: admin.publicKey,
      })
      .remainingAccounts([
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

    // Fetch and decode strategy data after report
    const strategyAccountInfoAfter = await provider.connection.getAccountInfo(strategy);
    if (!strategyAccountInfoAfter) {
      throw new Error("Strategy account not found after report");
    }
    
    const strategyAfter = deserializeOrcaStrategy(Buffer.from(strategyAccountInfoAfter.data));

    console.log("\nStrategy State AFTER report:");
    console.log("Total Assets:", strategyAfter.totalAssets.toString());
    console.log("Total Invested:", strategyAfter.totalInvested.toString());

    // Calculate and log changes
    console.log("\nChanges:");
    console.log("Total Assets Change:", 
      (strategyAfter.totalAssets - strategyBefore.totalAssets).toString()
    );
    console.log("Total Invested Change:", 
      (strategyAfter.totalInvested - strategyBefore.totalInvested).toString()
    );

    // Log invest tracker states after report
    console.log("\nInvest Tracker States AFTER report:");
    const tmacTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_TMAC);
    const wsolTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);
    
    console.log("TMAC Tracker:", {
      amount_invested: tmacTrackerAfter.amountInvested.toString(),
      amount_withdrawn: tmacTrackerAfter.amountWithdrawn.toString(),
      asset_amount: tmacTrackerAfter.assetAmount.toString(),
      asset_value: tmacTrackerAfter.assetValue.toString(),
    });
    
    console.log("WSOL Tracker:", {
      amount_invested: wsolTrackerAfter.amountInvested.toString(),
      amount_withdrawn: wsolTrackerAfter.amountWithdrawn.toString(),
      asset_amount: wsolTrackerAfter.assetAmount.toString(),
      asset_value: wsolTrackerAfter.assetValue.toString(),
    });

  } catch (error) {
    console.error("Error occurred:", error);
    if (error.logs) {
      console.error("Error logs:", error.logs);
    }
    // Print raw data if available for debugging
    if (error.data) {
      console.error("Raw data:", Buffer.from(error.data).toString('hex'));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
