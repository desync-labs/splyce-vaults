import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { Strategy } from "../../target/types/strategy";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import {
  Connection,
  TransactionInstruction,
  AddressLookupTableAccount,
  SystemProgram,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as dotenv from 'dotenv';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

// Load environment variables
dotenv.config();

// Load deployment addresses based on environment
const ADDRESSES_FILE = path.join(__dirname, 'deployment_addresses', 'addresses.json');
const ADDRESSES = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
const ENV = process.env.CLUSTER || 'devnet';

interface AssetConfig {
  address: string;
  decimals: number;
  pool: {
    id: string;
    token_vault_a: string;
    token_vault_b: string;
    oracle: string;
    tick_arrays: string[];
  };
  investment_config: {
    a_to_b_for_purchase: boolean;
    assigned_weight_bps: number;
  };
}

interface Config {
  programs: {
    whirlpool_program: string;
    token_program: string;
    whirlpools_config: string;
  };
  mints: {
    underlying: {
      address: string;
      decimals: number;
    };
    assets: {
      [key: string]: AssetConfig;
    };
  };
}

const CONFIG = ADDRESSES[ENV] as Config;

if (!CONFIG) {
  throw new Error(`No configuration found for environment: ${ENV}`);
}

// Get program IDs from config
const WHIRLPOOL_PROGRAM_ID = new PublicKey(CONFIG.programs.whirlpool_program);

// Get underlying token mint
const UNDERLYING_MINT = new PublicKey(CONFIG.mints.underlying.address);

async function main() {
  try {
    // Setup Provider and Programs
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // Load admin keypair
    const secretKeyPath = path.resolve(process.env.HOME!, ".config/solana/id.json");
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(secretKeyPath, 'utf8')));
    const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

    const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
    const strategyProgram = anchor.workspace.Strategy as Program<Strategy>;

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
      [vaultPDA.toBuffer(), new BN(0).toArrayLike(Buffer, 'le', 8)],
      strategyProgram.programId
    );

    // Get shares mint PDA
    const [sharesMint] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultPDA.toBuffer()],
      vaultProgram.programId
    );
    
    // Get user's token accounts
    const userUsdcATA = await getAssociatedTokenAddress(UNDERLYING_MINT, admin.publicKey);

    const userSharesATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin,
      sharesMint,
      admin.publicKey,
      false,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );


    // Get vault and strategy token accounts
    const vaultUsdcATA = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), vaultPDA.toBuffer()],
      vaultProgram.programId
    )[0];

    const strategyTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), strategy.toBuffer()],
      strategyProgram.programId
    )[0];

    // Modify the remaining accounts generation
    const combinedRemainingAccounts = [];

    for (const [symbol, asset] of Object.entries(CONFIG.mints.assets)) {
      const assetMint = new PublicKey(asset.address);
      const whirlpoolAddress = new PublicKey(asset.pool.id);
      
      // Get strategy token account and invest tracker
      const [strategyAssetAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("token_account"), assetMint.toBuffer(), strategy.toBuffer()],
        strategyProgram.programId
      );

      const [investTrackerAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("invest_tracker"), assetMint.toBuffer(), strategy.toBuffer()],
        strategyProgram.programId
      );

      // Get invest tracker data first
      const investTracker = await strategyProgram.account.investTracker.fetch(investTrackerAccount);
      
      // Determine account order based on a_to_b_for_purchase
      const [tokenAccountA, tokenAccountB] = investTracker.aToBForPurchase
        ? [strategyTokenAccount, strategyAssetAccount]
        : [strategyAssetAccount, strategyTokenAccount];

      // Add logging for invest tracker PDA
      console.log(`\nInvest Tracker PDA for ${symbol}:`);
      console.log("Asset Mint:", assetMint.toBase58());
      console.log("Strategy:", strategy.toBase58());
      console.log("Invest Tracker Account:", investTrackerAccount.toBase58());
      
      // Verify the invest tracker account exists and fetch its data
      try {
        const trackerAccount = await strategyProgram.account.investTracker.fetch(investTrackerAccount);
        console.log("Invest Tracker Data:", {
          whirlpoolId: trackerAccount.whirlpoolId.toString(),
          assetMint: trackerAccount.assetMint.toString(),
          amountInvested: trackerAccount.amountInvested.toString(),
          amountWithdrawn: trackerAccount.amountWithdrawn.toString(),
          assetAmount: trackerAccount.assetAmount.toString(),
          assetPrice: trackerAccount.assetPrice.toString(),
          sqrtPrice: trackerAccount.sqrtPrice.toString(),
          assetValue: trackerAccount.assetValue.toString(),
          aToBForPurchase: trackerAccount.aToBForPurchase,
          assignedWeight: trackerAccount.assignedWeight,
          currentWeight: trackerAccount.currentWeight
        });
      } catch (error) {
        console.error(`Failed to fetch invest tracker for ${symbol}:`, error);
      }

      // Select the correct tick arrays based on pool ID
      let tickArrayAddresses;
      switch (asset.pool.id) {
        case '3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt':
          tickArrayAddresses = [
            '3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM',
            '7knZZ461yySGbSEHeBUwEpg3VtAkQy8B9tp78RGgyUHE',
            'CpoSFo3ajrizueggtJr2ZjvYgdtkgugXtvhqcwkyCkKP'
          ];
          break;
        case '63cMwvN8eoaD39os9bKP8brmA7Xtov9VxahnPufWCSdg':
          tickArrayAddresses = [
            'EBHQcAfc4ncUkCxgGYxEWCSu744qFaBEBmyv3U9ajNzX',
            '8Eh57hMUNffNpQPb4K2nQZFPguiYgnCSi2ehvtmuE2PA',
            'FpGrraM6rZN1AkxMTyJrASda4q6BSdGJgqj544S1vcjL'
          ];
          break;
        case 'EgxU92G34jw6QDG9RuTX9StFg1PmHuDqkRKAE5kVEiZ4':
          tickArrayAddresses = [
            '9H4aVdyXbnnmbSJLjYahvZzrgdHyWVMq8i1v1fD7jqBt',
            'G13PKFAkn7rLHVT1fGbLPKAQFiMe6GiRKZ6e8ipxcn9q',
            '76ntKkVqoLqakqHb6TdkWKuD9kNv2JbPL3k6EHudWHxd'
          ];
          break;
        default:
          throw new Error(`No tick arrays defined for pool: ${asset.pool.id}`);
      }

      const remainingAccountsForAsset = [
        { pubkey: WHIRLPOOL_PROGRAM_ID, isWritable: false, isSigner: false },
        { pubkey: whirlpoolAddress, isWritable: true, isSigner: false },
        { pubkey: tokenAccountA, isWritable: true, isSigner: false },
        { pubkey: new PublicKey(asset.pool.token_vault_a), isWritable: true, isSigner: false },
        { pubkey: tokenAccountB, isWritable: true, isSigner: false },
        { pubkey: new PublicKey(asset.pool.token_vault_b), isWritable: true, isSigner: false },
        ...tickArrayAddresses.map(addr => ({ 
          pubkey: new PublicKey(addr), 
          isWritable: true, 
          isSigner: false 
        })),
        { pubkey: new PublicKey(asset.pool.oracle), isWritable: true, isSigner: false },
        { pubkey: investTrackerAccount, isWritable: true, isSigner: false },
        { pubkey: strategy, isWritable: true, isSigner: false },
      ];

      combinedRemainingAccounts.push(...remainingAccountsForAsset);
    }

    // Log initial balances
    const initialBalances = {
      userUsdc: await provider.connection.getTokenAccountBalance(userUsdcATA),
      userShares: await provider.connection.getTokenAccountBalance(userSharesATA.address),
      vaultUsdc: await provider.connection.getTokenAccountBalance(vaultUsdcATA),
      strategyUsdc: await provider.connection.getTokenAccountBalance(strategyTokenAccount),
    };

    console.log("\nInitial Balances:");
    console.log("User USDC:", initialBalances.userUsdc.value.uiAmount);
    console.log("User Shares:", initialBalances.userShares.value.uiAmount);
    console.log("Vault USDC:", initialBalances.vaultUsdc.value.uiAmount);
    console.log("Strategy USDC:", initialBalances.strategyUsdc.value.uiAmount);

    // Read lookup table address from ALT.json
    const altJsonPath = path.join(__dirname, 'ALT', 'ALT.json');
    const altJson = JSON.parse(fs.readFileSync(altJsonPath, 'utf8'));
    
    // Load the lookup table
    const lookupTableAccount = (
      await provider.connection.getAddressLookupTable(new PublicKey(altJson.lookupTableAddress))
    ).value;
    
    if (!lookupTableAccount) {
      throw new Error(`Lookup table not found for address: ${altJson.lookupTableAddress}`);
    }

    console.log("Loaded lookup table:", altJson.lookupTableAddress);

    // Define deposit amount (5 USDC)
    const depositAmount = new BN(5).mul(new BN(10).pow(new BN(6)));

    // Set compute unit limit
    const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 600_000,
    });

    // Set compute unit price
    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    // Get latest blockhash before creating transaction
    const latestBlockhash = await provider.connection.getLatestBlockhash();

    // Build the instruction for direct deposit
    const depositIx = await vaultProgram.methods
      .directDeposit(depositAmount)
      .accounts({
        vault: vaultPDA,
        userTokenAccount: userUsdcATA,
        userSharesAccount: userSharesATA.address,
        strategy: strategy,
        user: admin.publicKey,
        underlyingMint: UNDERLYING_MINT,
      })
      .remainingAccounts(combinedRemainingAccounts)
      .instruction();

    // Create a TransactionMessage with the lookup table
    const messageV0 = new TransactionMessage({
      payerKey: admin.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [computeUnitIx, computePriceIx, depositIx],
    }).compileToV0Message([lookupTableAccount]);

    console.log("Lookup table account:", lookupTableAccount);
    
    // Create VersionedTransaction
    const transaction = new VersionedTransaction(messageV0);

    // Sign the transaction
    transaction.sign([admin]);

    // Send the transaction
    const txid = await provider.connection.sendTransaction(transaction);

    console.log("Direct deposit transaction executed successfully. Txid:", txid);

    // Wait for confirmation
    const confirmation = await provider.connection.confirmTransaction(txid, "confirmed");
    console.log("Transaction confirmed:", confirmation);

    // Log final balances and fetch all asset balances
    const finalBalances = {
      userUsdc: await provider.connection.getTokenAccountBalance(userUsdcATA),
      userShares: await provider.connection.getTokenAccountBalance(userSharesATA.address),
      vaultUsdc: await provider.connection.getTokenAccountBalance(vaultUsdcATA),
      strategyUsdc: await provider.connection.getTokenAccountBalance(strategyTokenAccount),
    };

    console.log("\nFinal Balances:");
    console.log("User USDC:", finalBalances.userUsdc.value.uiAmount);
    console.log("User Shares:", finalBalances.userShares.value.uiAmount);
    console.log("Vault USDC:", finalBalances.vaultUsdc.value.uiAmount);
    console.log("Strategy USDC:", finalBalances.strategyUsdc.value.uiAmount);

    console.log("\nBalance Changes:");
    console.log("User USDC:", finalBalances.userUsdc.value.uiAmount! - initialBalances.userUsdc.value.uiAmount!);
    console.log("User Shares:", finalBalances.userShares.value.uiAmount! - initialBalances.userShares.value.uiAmount!);
    console.log("Vault USDC:", finalBalances.vaultUsdc.value.uiAmount! - initialBalances.vaultUsdc.value.uiAmount!);
    console.log("Strategy USDC:", finalBalances.strategyUsdc.value.uiAmount! - initialBalances.strategyUsdc.value.uiAmount!);

    // Log final balances for each asset
    for (const [symbol, asset] of Object.entries(CONFIG.mints.assets)) {
      const assetMint = new PublicKey(asset.address);
      
      const [strategyAssetAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("token_account"), assetMint.toBuffer(), strategy.toBuffer()],
        strategyProgram.programId
      );

      const [investTrackerAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("invest_tracker"), 
          assetMint.toBuffer(), 
          strategy.toBuffer()
        ],
        strategyProgram.programId
      );

      const assetBalance = await provider.connection.getTokenAccountBalance(strategyAssetAccount);
      const investTracker = await strategyProgram.account.investTracker.fetch(investTrackerAccount);

      console.log(`\n${symbol} Final Data:`);
      console.log("Balance:", assetBalance.value.uiAmount);
      console.log("Invest Tracker:", {
        amountInvested: investTracker.amountInvested.toString(),
        amountWithdrawn: investTracker.amountWithdrawn.toString(),
        assetAmount: investTracker.assetAmount.toString(),
        assetPrice: investTracker.assetPrice.toString(),
        aToBForPurchase: investTracker.aToBForPurchase,
        assignedWeight: investTracker.assignedWeight,
        currentWeight: investTracker.currentWeight
      });
    }

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
