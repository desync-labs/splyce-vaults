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

// Constants
const WHIRLPOOL_PROGRAM_ID = new PublicKey(
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
);
const WHIRLPOOL_ID = new PublicKey(
  "3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt"
);

// Token Mints
const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);
const USDC_MINT = new PublicKey(
  "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"
);

// Swap Vaults
const TOKEN_VAULT_A = new PublicKey(
  "C9zLV5zWF66j3rZj3uuhDqvfuA8esJyWnruGzDW9qEj2"
);
const TOKEN_VAULT_B = new PublicKey(
  "7DM3RMz2yzUB8yPRQM3FMZgdFrwZGMsabsfsKopWktoX"
);

// Add these constants
const TICK_ARRAY_ADDRESSES = [
  new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
  new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
  new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
];

const ORACLE = new PublicKey("2KEWNc3b6EfqoWQpfKQMHh4mhRyKXYRdPbtGRTJX3Cip");

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
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(secretKeyPath, 'utf8')));
    const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

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

    const [strategyTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), strategy.toBuffer()],
      strategyProgram.programId
    );

    const [INVEST_TRACKER_ACCOUNT_WSOL] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("invest_tracker"),
        WSOL_MINT.toBuffer(),
        strategy.toBuffer(),
      ],
      strategyProgram.programId
    );

    // Amount to free (sell)
    const amountToFree = new BN(1_000_000); //need to comeback

    // Build remaining accounts for WSOL swap
    const remainingAccounts = [
      {
        pubkey: WHIRLPOOL_PROGRAM_ID, // index 0
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: WHIRLPOOL_ID, // index 1
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyWSOLAccount, // index 2
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TOKEN_VAULT_A, // index 3
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyTokenAccount, // index 4
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TOKEN_VAULT_B, // index 5
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES[0], // index 6
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES[1], // index 7
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES[2], // index 8
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: ORACLE, // index 9
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: INVEST_TRACKER_ACCOUNT_WSOL, // index 10
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategy, // index 11
        isWritable: true,
        isSigner: false,
      },
    ];

    // Log invest tracker and balances before
    const wsolBalanceBefore = await provider.connection.getTokenAccountBalance(strategyWSOLAccount);
    const usdcBalanceBefore = await provider.connection.getTokenAccountBalance(strategyTokenAccount);
    const investTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);
    
    console.log("\n=== State BEFORE free_funds ===");
    console.log("WSOL balance:", wsolBalanceBefore.value.uiAmount);
    console.log("USDC balance:", usdcBalanceBefore.value.uiAmount);
    console.log("Invest Tracker:", {
      amountInvested: investTrackerBefore.amountInvested.toString(),
      amountWithdrawn: investTrackerBefore.amountWithdrawn.toString(),
      assetAmount: investTrackerBefore.assetAmount.toString(),
      assetPrice: investTrackerBefore.assetPrice.toString(),
      assetValue: investTrackerBefore.assetValue.toString(),
      currentWeight: investTrackerBefore.currentWeight,
    });

    // Call free_funds instruction
    await strategyProgram.methods
      .freeFunds(amountToFree)
      .accounts({
        strategy: strategy,
        signer: admin.publicKey,
      })
      .remainingAccounts(remainingAccounts)
      .signers([admin])
      .rpc();

    // Log invest tracker and balances after
    const wsolBalanceAfter = await provider.connection.getTokenAccountBalance(strategyWSOLAccount);
    const usdcBalanceAfter = await provider.connection.getTokenAccountBalance(strategyTokenAccount);
    const investTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);

    console.log("\n=== State AFTER free_funds ===");
    console.log("WSOL balance:", wsolBalanceAfter.value.uiAmount);
    console.log("USDC balance:", usdcBalanceAfter.value.uiAmount);
    console.log("Invest Tracker:", {
      amountInvested: investTrackerAfter.amountInvested.toString(),
      amountWithdrawn: investTrackerAfter.amountWithdrawn.toString(),
      assetAmount: investTrackerAfter.assetAmount.toString(),
      assetPrice: investTrackerAfter.assetPrice.toString(),
      assetValue: investTrackerAfter.assetValue.toString(),
      currentWeight: investTrackerAfter.currentWeight,
    });

    console.log("\n=== Changes ===");
    console.log("WSOL sold:", wsolBalanceBefore.value.uiAmount! - wsolBalanceAfter.value.uiAmount!);
    console.log("USDC received:", usdcBalanceAfter.value.uiAmount! - usdcBalanceBefore.value.uiAmount!);
    console.log("Invest Tracker changes:", {
      amountInvested: investTrackerAfter.amountInvested.sub(investTrackerBefore.amountInvested).toString(),
      amountWithdrawn: investTrackerAfter.amountWithdrawn.sub(investTrackerBefore.amountWithdrawn).toString(),
      assetAmount: investTrackerAfter.assetAmount.sub(investTrackerBefore.assetAmount).toString(),
      assetPrice: investTrackerAfter.assetPrice.sub(investTrackerBefore.assetPrice).toString(),
      assetValue: investTrackerAfter.assetValue.sub(investTrackerBefore.assetValue).toString(),
      currentWeight: investTrackerAfter.currentWeight - investTrackerBefore.currentWeight,
    });

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});