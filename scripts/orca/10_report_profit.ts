import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { Strategy } from "../../target/types/strategy";
import { BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import { PublicKey } from "@solana/web3.js";
import { AccessControl } from "../../target/types/access_control";
import { Accountant } from "../../target/types/accountant";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { formatInvestTrackerData } from "./utils/format-invest-tracker";

const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);
const TMAC_MINT = new PublicKey(
  "Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6"
);

const USDC_MINT = new PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k");

const USDT_MINT = new PublicKey("H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPm");
const SAMO_MINT = new PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa");

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
    const accessControlProgram = anchor.workspace.AccessControl as Program<AccessControl>;
    const accountantProgram = anchor.workspace.Accountant as Program<Accountant>;
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

    const [INVEST_TRACKER_ACCOUNT_USDT] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("invest_tracker"),
        USDT_MINT.toBuffer(),
        strategy.toBuffer(),
      ],
      strategyProgram.programId
    );

    const [INVEST_TRACKER_ACCOUNT_SAMO] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("invest_tracker"),
        SAMO_MINT.toBuffer(),
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
    const usdtTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_USDT);
    const samoTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_SAMO);

    console.log("TMAC Tracker:", formatInvestTrackerData(tmacTrackerBefore));
    
    console.log("WSOL Tracker:", formatInvestTrackerData(wsolTrackerBefore));

    console.log("USDT Tracker:", formatInvestTrackerData(usdtTrackerBefore));

    console.log("SAMO Tracker:", formatInvestTrackerData(samoTrackerBefore));

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
        tokenProgram: TOKEN_PROGRAM_ID,
        underlyingMint: USDC_MINT,
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
        {
          pubkey: INVEST_TRACKER_ACCOUNT_USDT,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: USDT_MINT,
          isWritable: false,
          isSigner: false,
        },
        {
          pubkey: INVEST_TRACKER_ACCOUNT_SAMO,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: SAMO_MINT,
          isWritable: false,
          isSigner: false,
        },
      ])
      .signers([admin])
      .rpc();

    console.log("\nReport profit completed successfully!");

    // Get strategy data PDA
    const [strategyData] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("strategy_data"),
        vaultPDA.toBuffer(),
        strategy.toBuffer()
      ],
      tokenizedVaultProgram.programId
    );

    // Fetch states BEFORE process report
    const vaultBefore = await tokenizedVaultProgram.account.vault.fetch(vaultPDA);
    const strategyDataBefore = await tokenizedVaultProgram.account.strategyData.fetch(strategyData);
    
    console.log("\nState BEFORE Process Report:");
    console.log("Vault State:");
    console.log("- Total Debt:", vaultBefore.totalDebt.toString());
    console.log("- Total Shares:", vaultBefore.totalShares.toString());
    console.log("- Last Profit Update:", vaultBefore.lastProfitUpdate.toString());
    console.log("- Profit Unlocking Rate:", vaultBefore.profitUnlockingRate.toString());
    console.log("- Full Profit Unlock Date:", vaultBefore.fullProfitUnlockDate.toString());

    console.log("\nStrategy Data State:");
    console.log("- Current Debt:", strategyDataBefore.currentDebt.toString());
    console.log("- Max Debt:", strategyDataBefore.maxDebt.toString());
    console.log("- Last Update:", strategyDataBefore.lastUpdate.toString());

    // Get shares mint PDA
    const [sharesMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultPDA.toBuffer()],
      tokenizedVaultProgram.programId
    );

    // Get vault shares token account PDA
    const [vaultSharesTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares_account"), vaultPDA.toBuffer()],
      tokenizedVaultProgram.programId
    );

    // Get accountant PDA      //calculate accountant PDA
      const accountant = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(new Uint8Array(new BigUint64Array([BigInt(0)]).buffer))
        ],
        accountantProgram.programId
      )[0];

    // Call process_report with all required accounts
    await tokenizedVaultProgram.methods
      .processReport()
      .accounts({
        vault: vaultPDA,
        strategy,
        accountant: accountant,
      })
      .signers([admin])
      .rpc();

    console.log("\nProcess report completed successfully!");

    // Fetch states AFTER process report
    const vaultAfter = await tokenizedVaultProgram.account.vault.fetch(vaultPDA);
    const strategyDataAfter = await tokenizedVaultProgram.account.strategyData.fetch(strategyData);
    
    console.log("\nState AFTER Process Report:");
    console.log("Vault State:");
    console.log("- Total Debt:", vaultAfter.totalDebt.toString());
    console.log("- Total Shares:", vaultAfter.totalShares.toString());
    console.log("- Last Profit Update:", vaultAfter.lastProfitUpdate.toString());
    console.log("- Profit Unlocking Rate:", vaultAfter.profitUnlockingRate.toString());
    console.log("- Full Profit Unlock Date:", vaultAfter.fullProfitUnlockDate.toString());

    console.log("\nStrategy Data State:");
    console.log("- Current Debt:", strategyDataAfter.currentDebt.toString());
    console.log("- Max Debt:", strategyDataAfter.maxDebt.toString());
    console.log("- Last Update:", strategyDataAfter.lastUpdate.toString());

    // Calculate and log changes
    console.log("\nChanges:");
    console.log("Vault Changes:");
    console.log("- Total Debt Change:", 
      vaultAfter.totalDebt.sub(vaultBefore.totalDebt).toString());
    console.log("- Total Shares Change:", 
      vaultAfter.totalShares.sub(vaultBefore.totalShares).toString());
    
    console.log("Strategy Data Changes:");
    console.log("- Current Debt Change:", 
      strategyDataAfter.currentDebt.sub(strategyDataBefore.currentDebt).toString());
    console.log("- Last Update Change:", 
      strategyDataAfter.lastUpdate.toNumber() - strategyDataBefore.lastUpdate.toNumber());

    // Log invest tracker states after report
    console.log("\nInvest Tracker States AFTER report:");
    const tmacTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_TMAC);
    const wsolTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);
    const usdtTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_USDT);
    const samoTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_SAMO);

    console.log("TMAC Tracker:", formatInvestTrackerData(tmacTrackerAfter));
    
    console.log("WSOL Tracker:", formatInvestTrackerData(wsolTrackerAfter));

    console.log("USDT Tracker:", formatInvestTrackerData(usdtTrackerAfter));

    console.log("SAMO Tracker:", formatInvestTrackerData(samoTrackerAfter));

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
