import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { Strategy } from "../../target/types/strategy";
import { AccessControl } from "../../target/types/access_control";
import { OrcaStrategyConfig, OrcaStrategyConfigSchema } from "../../tests/utils/schemas";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as borsh from "borsh";
import * as fs from "fs";
import * as path from "path";
import { PublicKey, Keypair, Transaction, Connection, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction
} from "@solana/spl-token";

// Constants
const METADATA_SEED = "metadata";
const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Swap-related constants for WSOL
const WHIRLPOOL_PROGRAM_ID_WSOL = new PublicKey(
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
);
// Whirlpool for WSOL (replace with actual if different)
const WHIRLPOOL_ID_WSOL = new PublicKey(
  "3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt"
);
const TICK_ARRAY_ADDRESSES_WSOL = [
  new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
  new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
  new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
];
const ORACLE_ADDRESS_WSOL = new PublicKey(
  "2KEWNc3b6EfqoWQpfKQMHh4mhRyKXYRdPbtGRTJX3Cip"
);

// Swap-related constants for TMAC
const WHIRLPOOL_PROGRAM_ID_TMAC = new PublicKey(
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc" // same as WSOL for now but may change
);
// Whirlpool for TMAC (replace with actual if different)
const WHIRLPOOL_ID_TMAC = new PublicKey(
  "H3xhLrSEyDFm6jjG42QezbvhSxF5YHW75VdGUnqeEg5y"
);
const TICK_ARRAY_ADDRESSES_TMAC = [
  new PublicKey("5NApkpCKADoeYk8s2SHa2u1nHBPEXr937c1amNgjMDdy"),
  new PublicKey("5NApkpCKADoeYk8s2SHa2u1nHBPEXr937c1amNgjMDdy"),
  new PublicKey("5NApkpCKADoeYk8s2SHa2u1nHBPEXr937c1amNgjMDdy"),
];
const ORACLE_ADDRESS_TMAC = new PublicKey(
  "34mJni6KtJBUWoqsT5yZUJ89ywHnYaU11bh27cNHPTov"
);

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

// Swap Vaults for WSOL
const TOKEN_VAULT_A_WSOL = new PublicKey(
  "C9zLV5zWF66j3rZj3uuhDqvfuA8esJyWnruGzDW9qEj2"
);
const TOKEN_VAULT_B_WSOL = new PublicKey(
  "7DM3RMz2yzUB8yPRQM3FMZgdFrwZGMsabsfsKopWktoX"
);

// Swap Vaults for TMAC
const TOKEN_VAULT_A_TMAC = new PublicKey(
  "2qE191zsJCJdMXsPcwkVJ5MyiSfreNpQtKpXgAMkwhUf"
);
const TOKEN_VAULT_B_TMAC = new PublicKey(
  "G6qeUBPqU3Ryabi4rwVUgHpLh6wmHLvi8jDQexTR1CTU"
);

async function main() {
  try {
    // ============================
    // Setup Provider and Programs
    // ============================
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

    const vault_index = 0; // Make sure this matches the index used in init_orca_strategy.ts

    const [vaultPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("vault"),
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(vault_index)]).buffer))
      ],
      tokenizedVaultProgram.programId
    );

    // PDA for Strategy Data
    const [strategy, _] = await anchor.web3.PublicKey.findProgramAddressSync(
      [vaultPDA.toBuffer(),
      new BN(0).toArrayLike(Buffer, 'le', 8)
      ],
      strategyProgram.programId
    );

    console.log("Strategy Data PDA:", strategy.toBase58());

    // ============================
    // Update Debt on the Strategy
    // ============================
    const depositAmount = new BN(10).mul(new BN(10).pow(new BN(6))); // x devUSDC

    //I think updatingDebt can be not triggered since I would run this script along with other scripts
    // try {
    //   await tokenizedVaultProgram.methods
    //     .updateDebt(depositAmount.mul(new BN(1)))
    //     .accounts({
    //       vault: vaultPDA,
    //       strategy: strategy,
    //       signer: admin.publicKey,
    //     })
    //     .signers([admin])
    //     .rpc();

    //   console.log("Debt updated successfully.");
    // } catch (error) {
    //   console.error("Error updating debt:", error);
    // }

    // Check the balance of devUSDC in the strategy token account after updating debt
    const strategyTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), strategy.toBuffer()],
      strategyProgram.programId,
    )[0];

    const strategyDevUSDCBalanceAfterUpdate = await provider.connection.getTokenAccountBalance(strategyTokenAccount);
    console.log("Strategy devUSDC account balance after updating debt:", strategyDevUSDCBalanceAfterUpdate.value.uiAmount);

    // ============================
    // 3. Purchase Assets using Orca Strategy
    // ============================
    console.log("Purchasing assets using the Orca Strategy...");

    // Define the amount for the swap
    const amount = new BN(8).mul(new BN(10).pow(new BN(6))); // amount for both TMAC and WSOL combined

    // ======= Get Strategy TMAC Token Account PDA =======
    const [strategyTMACAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_account"), TMAC_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );
    console.log("Strategy TMAC token account address:", strategyTMACAccount.toBase58());

    // ======= Get Strategy WSOL Token Account PDA =======
    const [strategyWSOLAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_account"), WSOL_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );
    console.log("Strategy WSOL token account address:", strategyWSOLAccount.toBase58());

    // Check TMAC and WSOL balances before purchase
    const tmacBalanceBefore = await provider.connection.getTokenAccountBalance(strategyTMACAccount);
    const wsolBalanceBefore = await provider.connection.getTokenAccountBalance(strategyWSOLAccount);
    console.log("TMAC balance before purchase:", tmacBalanceBefore.value.uiAmount);
    console.log("WSOL balance before purchase:", wsolBalanceBefore.value.uiAmount);

    // ======= Get Invest Tracker PDA =======
    const [INVEST_TRACKER_ACCOUNT_TMAC] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), TMAC_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );
    console.log("Invest Tracker TMAC address:", INVEST_TRACKER_ACCOUNT_TMAC.toBase58());

    // ======= Get Invest Tracker PDA for WSOL =======
    const [INVEST_TRACKER_ACCOUNT_WSOL] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), WSOL_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );
    console.log("Invest Tracker WSOL address:", INVEST_TRACKER_ACCOUNT_WSOL.toBase58());

    // Log invest tracker states before purchase
    console.log("\nInvest Tracker States BEFORE purchase:");
    const tmacTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_TMAC);
    const wsolTrackerBefore = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);

    console.log("TMAC Tracker:", {
      whirlpool_id: tmacTrackerBefore.whirlpoolId.toString(),
      asset_mint: tmacTrackerBefore.assetMint.toString(),
      amount_invested: tmacTrackerBefore.amountInvested.toString(),
      amount_withdrawn: tmacTrackerBefore.amountWithdrawn.toString(),
      asset_amount: tmacTrackerBefore.assetAmount.toString(),
      asset_price: tmacTrackerBefore.assetPrice.toString(),
      sqrt_price: tmacTrackerBefore.sqrtPrice.toString(),
      asset_value: tmacTrackerBefore.assetValue.toString(),
      asset_decimals: tmacTrackerBefore.assetDecimals,
      underlying_decimals: tmacTrackerBefore.underlyingDecimals,
      a_to_b_for_purchase: tmacTrackerBefore.aToBForPurchase,
      assigned_weight: tmacTrackerBefore.assignedWeight,
      current_weight: tmacTrackerBefore.currentWeight,
    });

    console.log("WSOL Tracker:", {
      whirlpool_id: wsolTrackerBefore.whirlpoolId.toString(),
      asset_mint: wsolTrackerBefore.assetMint.toString(),
      amount_invested: wsolTrackerBefore.amountInvested.toString(),
      amount_withdrawn: wsolTrackerBefore.amountWithdrawn.toString(),
      asset_amount: wsolTrackerBefore.assetAmount.toString(),
      asset_price: wsolTrackerBefore.assetPrice.toString(),
      sqrt_price: wsolTrackerBefore.sqrtPrice.toString(),
      asset_value: wsolTrackerBefore.assetValue.toString(),
      asset_decimals: wsolTrackerBefore.assetDecimals,
      underlying_decimals: wsolTrackerBefore.underlyingDecimals,
      a_to_b_for_purchase: wsolTrackerBefore.aToBForPurchase,
      assigned_weight: wsolTrackerBefore.assignedWeight,
      current_weight: wsolTrackerBefore.currentWeight,
    });

    // ======= Define Remaining Accounts for TMAC =======
    const remainingAccountsForTMAC = [
      {
        pubkey: WHIRLPOOL_PROGRAM_ID_TMAC, // whirlpool_program (index 0)
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: WHIRLPOOL_ID_TMAC, // whirlpool (index 1)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyTMACAccount, // token_owner_account_a (index 2)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TOKEN_VAULT_A_TMAC, // token_vault_a (index 3)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyTokenAccount, // token_owner_account_b (index 4)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TOKEN_VAULT_B_TMAC, // token_vault_b (index 5)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_TMAC[0], // tick_array_0 (index 6)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_TMAC[1], // tick_array_1 (index 7)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_TMAC[2], // tick_array_2 (index 8)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: ORACLE_ADDRESS_TMAC, // oracle (index 9)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: INVEST_TRACKER_ACCOUNT_TMAC, // invest_tracker (index 10)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategy, // orca_strategy (index 11)
        isWritable: true,
        isSigner: false,
      }
    ];

    // ======= Define Remaining Accounts for WSOL =======
    const remainingAccountsForWSOL = [
      {
        pubkey: WHIRLPOOL_PROGRAM_ID_WSOL, // whirlpool_program (index 0)
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: WHIRLPOOL_ID_WSOL, // whirlpool (index 1)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyWSOLAccount, // token_owner_account_a (index 2)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TOKEN_VAULT_A_WSOL, // token_vault_a (index 3)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyTokenAccount, // token_owner_account_b (index 4)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TOKEN_VAULT_B_WSOL, // token_vault_b (index 5)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_WSOL[0], // tick_array_0 (index 6)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_WSOL[1], // tick_array_1 (index 7)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_WSOL[2], // tick_array_2 (index 8)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: ORACLE_ADDRESS_WSOL, // oracle (index 9)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: INVEST_TRACKER_ACCOUNT_WSOL, // invest_tracker (index 10)
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategy, // orca_strategy (index 11)
        isWritable: true,
        isSigner: false,
      }
    ];

    // ======= Combine Remaining Accounts =======
    const combinedRemainingAccounts = [
      ...remainingAccountsForTMAC,
      ...remainingAccountsForWSOL
    ];

    // ======= Call deployFunds once with combined remaining accounts =======
    try {
      await strategyProgram.methods
        .deployFunds(amount)
        .accounts({
          strategy: strategy,
          signer: admin.publicKey,
        })
        .remainingAccounts(combinedRemainingAccounts)
        .signers([admin])
        .rpc();

      console.log("deployFunds called successfully for TMAC and WSOL. Swaps initiated.");

      // Check TMAC and WSOL balances after purchase
      const tmacBalanceAfter = await provider.connection.getTokenAccountBalance(strategyTMACAccount);
      const wsolBalanceAfter = await provider.connection.getTokenAccountBalance(strategyWSOLAccount);
      console.log("TMAC balance after purchase:", tmacBalanceAfter.value.uiAmount);
      console.log("WSOL balance after purchase:", wsolBalanceAfter.value.uiAmount);

      console.log("TMAC balance change:", tmacBalanceAfter.value.uiAmount - tmacBalanceBefore.value.uiAmount);
      console.log("WSOL balance change:", wsolBalanceAfter.value.uiAmount - wsolBalanceBefore.value.uiAmount);

      // Log invest tracker states after purchase
      console.log("\nInvest Tracker States AFTER purchase:");
      const tmacTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_TMAC);
      const wsolTrackerAfter = await strategyProgram.account.investTracker.fetch(INVEST_TRACKER_ACCOUNT_WSOL);

      console.log("TMAC Tracker:", {
        whirlpool_id: tmacTrackerAfter.whirlpoolId.toString(),
        asset_mint: tmacTrackerAfter.assetMint.toString(),
        amount_invested: tmacTrackerAfter.amountInvested.toString(),
        amount_withdrawn: tmacTrackerAfter.amountWithdrawn.toString(),
        asset_amount: tmacTrackerAfter.assetAmount.toString(),
        asset_price: tmacTrackerAfter.assetPrice.toString(),
        sqrt_price: tmacTrackerAfter.sqrtPrice.toString(),
        asset_value: tmacTrackerAfter.assetValue.toString(),
        asset_decimals: tmacTrackerAfter.assetDecimals,
        underlying_decimals: tmacTrackerAfter.underlyingDecimals,
        a_to_b_for_purchase: tmacTrackerAfter.aToBForPurchase,
        assigned_weight: tmacTrackerAfter.assignedWeight,
        current_weight: tmacTrackerAfter.currentWeight,
      });

      console.log("WSOL Tracker:", {
        whirlpool_id: wsolTrackerAfter.whirlpoolId.toString(),
        asset_mint: wsolTrackerAfter.assetMint.toString(),
        amount_invested: wsolTrackerAfter.amountInvested.toString(),
        amount_withdrawn: wsolTrackerAfter.amountWithdrawn.toString(),
        asset_amount: wsolTrackerAfter.assetAmount.toString(),
        asset_price: wsolTrackerAfter.assetPrice.toString(),
        sqrt_price: wsolTrackerAfter.sqrtPrice.toString(),
        asset_value: wsolTrackerAfter.assetValue.toString(),
        asset_decimals: wsolTrackerAfter.assetDecimals,
        underlying_decimals: wsolTrackerAfter.underlyingDecimals,
        a_to_b_for_purchase: wsolTrackerAfter.aToBForPurchase,
        assigned_weight: wsolTrackerAfter.assignedWeight,
        current_weight: wsolTrackerAfter.currentWeight,
      });

    } catch (error) {
      console.error("Error during deployFunds:", error);
    }

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});