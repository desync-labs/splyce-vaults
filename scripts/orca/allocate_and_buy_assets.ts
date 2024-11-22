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
    const [strategyData, _] = await anchor.web3.PublicKey.findProgramAddressSync(
      [vaultPDA.toBuffer(),
      new BN(0).toArrayLike(Buffer, 'le', 8)
      ],
      strategyProgram.programId
    );

    console.log("Strategy Data PDA:", strategyData.toBase58());

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
    //       strategy: strategyData,
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
      [Buffer.from("underlying"), strategyData.toBuffer()],
      strategyProgram.programId,
    )[0];

    const strategyDevUSDCBalanceAfterUpdate = await provider.connection.getTokenAccountBalance(strategyTokenAccount);
    console.log("Strategy devUSDC account balance after updating debt:", strategyDevUSDCBalanceAfterUpdate.value.uiAmount);

    // ============================
    // 3. Purchase Assets using Orca Strategy
    // ============================
    console.log("Purchasing assets using the Orca Strategy...");

    // Define the amounts and directions for the swaps
    const amounts = [new BN(1).mul(new BN(10).pow(new BN(6))), new BN(1).mul(new BN(10).pow(new BN(6)))]; // amounts for TMAC and WSOL
    const aToB = [false, false]; // devUSDC -> TMAC and devUSDC -> WSOL

    // ======= Get Strategy TMAC Token Account PDA =======
    const [strategyTMACAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_account"), TMAC_MINT.toBuffer(), strategyData.toBuffer()],
      strategyProgram.programId
    );
    console.log("Strategy TMAC token account address:", strategyTMACAccount.toBase58());

    // ======= Get Strategy WSOL Token Account PDA =======
    const [strategyWSOLAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_account"), WSOL_MINT.toBuffer(), strategyData.toBuffer()],
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
      [Buffer.from("invest_tracker"), TMAC_MINT.toBuffer(), strategyData.toBuffer()],
      strategyProgram.programId
    );
    console.log("Invest Tracker TMAC address:", INVEST_TRACKER_ACCOUNT_TMAC.toBase58());

    // ======= Get Invest Tracker PDA for WSOL =======
    const [INVEST_TRACKER_ACCOUNT_WSOL] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), WSOL_MINT.toBuffer(), strategyData.toBuffer()],
      strategyProgram.programId
    );
    console.log("Invest Tracker WSOL address:", INVEST_TRACKER_ACCOUNT_WSOL.toBase58());

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
        pubkey: strategyData, // orca_strategy (index 11)
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
        pubkey: strategyData, // orca_strategy (index 11)
        isWritable: true,
        isSigner: false,
      }
    ];

    // ======= Combine Remaining Accounts =======
    const combinedRemainingAccounts = [
      ...remainingAccountsForTMAC,
      ...remainingAccountsForWSOL
    ];

    // ======= Call orca_purchase_assets once with combined remaining accounts =======
    try {
      await strategyProgram.methods
        .orcaPurchaseAssets(amounts, aToB)
        .accounts({
          strategy: strategyData,
          signer: admin.publicKey,
        })
        .remainingAccounts(combinedRemainingAccounts)
        .signers([admin])
        .rpc();

      console.log("orca_purchase_assets called successfully for TMAC and WSOL. Swaps initiated.");

      // Check TMAC and WSOL balances after purchase
      const tmacBalanceAfter = await provider.connection.getTokenAccountBalance(strategyTMACAccount);
      const wsolBalanceAfter = await provider.connection.getTokenAccountBalance(strategyWSOLAccount);
      console.log("TMAC balance after purchase:", tmacBalanceAfter.value.uiAmount);
      console.log("WSOL balance after purchase:", wsolBalanceAfter.value.uiAmount);

      console.log("TMAC balance change:", tmacBalanceAfter.value.uiAmount - tmacBalanceBefore.value.uiAmount);
      console.log("WSOL balance change:", wsolBalanceAfter.value.uiAmount - wsolBalanceBefore.value.uiAmount);

    } catch (error) {
      console.error("Error during orca_purchase_assets:", error);
    }

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});