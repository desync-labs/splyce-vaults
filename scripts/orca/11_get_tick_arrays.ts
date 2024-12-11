import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaDAL } from "./orca-utils/dal/orca-dal";
import { getTickArrayPublicKeysForSwap } from "./orca-utils/getTickArrayPublicKeysForSwap";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Strategy } from "../../target/types/strategy";

// Common constants
const WHIRLPOOLS_CONFIG = new PublicKey("FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR");
const WHIRLPOOL_PROGRAM_ID = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");

// Token Mints
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const TMAC_MINT = new PublicKey("Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6");
const USDT_MINT = new PublicKey("H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPm");
const SAMO_MINT = new PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa");

// Whirlpool IDs
const WHIRLPOOL_ID_WSOL = new PublicKey("3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt");
const WHIRLPOOL_ID_TMAC = new PublicKey("H3xhLrSEyDFm6jjG42QezbvhSxF5YHW75VdGUnqeEg5y");
const WHIRLPOOL_ID_USDT = new PublicKey("63cMwvN8eoaD39os9bKP8brmA7Xtov9VxahnPufWCSdg");
const WHIRLPOOL_ID_SAMO = new PublicKey("EgxU92G34jw6QDG9RuTX9StFg1PmHuDqkRKAE5kVEiZ4");

async function main() {
  try {
    // Setup Provider and Program
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const strategyProgram = anchor.workspace.Strategy as Program<Strategy>;

    // Create OrcaDAL instance with devnet connection
    const connection = new Connection("https://api.devnet.solana.com");
    const dal = new OrcaDAL(WHIRLPOOLS_CONFIG, WHIRLPOOL_PROGRAM_ID, connection);

    // Get strategy PDA
    const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("strategy")],
      strategyProgram.programId
    );

    // Get invest tracker PDAs
    const [INVEST_TRACKER_ACCOUNT_WSOL] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), WSOL_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    console.log("INVEST_TRACKER_ACCOUNT_WSOL", INVEST_TRACKER_ACCOUNT_WSOL.toBase58());

    const [INVEST_TRACKER_ACCOUNT_TMAC] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), TMAC_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    console.log("INVEST_TRACKER_ACCOUNT_TMAC", INVEST_TRACKER_ACCOUNT_TMAC.toBase58());

    const [INVEST_TRACKER_ACCOUNT_USDT] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), USDT_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    console.log("INVEST_TRACKER_ACCOUNT_USDT", INVEST_TRACKER_ACCOUNT_USDT.toBase58());

    const [INVEST_TRACKER_ACCOUNT_SAMO] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), SAMO_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    console.log("INVEST_TRACKER_ACCOUNT_SAMO", INVEST_TRACKER_ACCOUNT_SAMO.toBase58());

    // Function to get tick array public keys for a given whirlpool
    async function getTickArraysForWhirlpool(poolAddress: PublicKey, investTrackerAccount: PublicKey) {
      const investTracker = await strategyProgram.account.investTracker.fetch(investTrackerAccount);
      const aToBForPurchase = investTracker.aToBForPurchase;

      // Get tick arrays for buying flow
      const tickArraysBuying = await getTickArrayPublicKeysForSwap(poolAddress, WHIRLPOOL_PROGRAM_ID, aToBForPurchase, dal);
      console.log(`Tick Arrays for Buying (Pool: ${poolAddress.toBase58()}):`, tickArraysBuying.map(pk => pk.toBase58()));

      // Get tick arrays for selling flow
      const tickArraysSelling = await getTickArrayPublicKeysForSwap(poolAddress, WHIRLPOOL_PROGRAM_ID, !aToBForPurchase, dal);
      console.log(`Tick Arrays for Selling (Pool: ${poolAddress.toBase58()}):`, tickArraysSelling.map(pk => pk.toBase58()));
    }

    // Get tick arrays for all whirlpools
    await getTickArraysForWhirlpool(WHIRLPOOL_ID_WSOL, INVEST_TRACKER_ACCOUNT_WSOL);
    await getTickArraysForWhirlpool(WHIRLPOOL_ID_TMAC, INVEST_TRACKER_ACCOUNT_TMAC);
    await getTickArraysForWhirlpool(WHIRLPOOL_ID_USDT, INVEST_TRACKER_ACCOUNT_USDT);
    await getTickArraysForWhirlpool(WHIRLPOOL_ID_SAMO, INVEST_TRACKER_ACCOUNT_SAMO);

  } catch (error) {
    console.error("Error occurred:", error);
    if ('logs' in error) {
      console.error("Program Logs:", error.logs);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
