import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { Strategy } from "../../target/types/strategy";
import { AccessControl } from "../../target/types/access_control";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import {
  Connection,
  Keypair,
  TransactionInstruction,
  AddressLookupTableAccount,
  SystemProgram,
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableProgram,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
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
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
);
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
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const TMAC_MINT = new PublicKey("Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6");
const USDC_MINT = new PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k");

// Swap Vaults for WSOL
const TOKEN_VAULT_A_WSOL = new PublicKey("C9zLV5zWF66j3rZj3uuhDqvfuA8esJyWnruGzDW9qEj2");
const TOKEN_VAULT_B_WSOL = new PublicKey("7DM3RMz2yzUB8yPRQM3FMZgdFrwZGMsabsfsKopWktoX");

// Swap Vaults for TMAC
const TOKEN_VAULT_A_TMAC = new PublicKey("2qE191zsJCJdMXsPcwkVJ5MyiSfreNpQtKpXgAMkwhUf");
const TOKEN_VAULT_B_TMAC = new PublicKey("G6qeUBPqU3Ryabi4rwVUgHpLh6wmHLvi8jDQexTR1CTU");

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
    const secretKeyString = fs.readFileSync(secretKeyPath, "utf8");
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

    console.log("Admin PublicKey:", admin.publicKey.toBase58());

    // Initialize programs
    const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
    const strategyProgram = anchor.workspace.Strategy as Program<Strategy>;
    const accessControlProgram = anchor.workspace.AccessControl as Program<AccessControl>;

    console.log("Vault Program ID:", vaultProgram.programId.toBase58());
    console.log("Strategy Program ID:", strategyProgram.programId.toBase58());
    console.log("Access Control Program ID:", accessControlProgram.programId.toBase58());

    // ============================
    // Derive necessary PDAs
    // ============================
    const vault_index = 0; // Should match the index used in previous scripts

    // Derive vault PDA
    const [vaultPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("vault"),
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(vault_index)]).buffer)),
      ],
      vaultProgram.programId
    );
    console.log("Vault PDA:", vaultPDA.toBase58());

    // Derive shares mint
    const [sharesMint] = await PublicKey.findProgramAddress(
      [Buffer.from("shares"), vaultPDA.toBuffer()],
      vaultProgram.programId
    );
    console.log("Shares Mint:", sharesMint.toBase58());

    // Get user's USDC ATA and shares ATA
    const userUsdcATA = await getAssociatedTokenAddress(
      USDC_MINT,
      admin.publicKey
    );
    console.log("User USDC ATA:", userUsdcATA.toBase58());

    const userSharesATA = await getAssociatedTokenAddress(
      sharesMint,
      admin.publicKey
    );
    console.log("User Shares ATA:", userSharesATA.toBase58());

    // Get vault's USDC ATA
    const [vaultUsdcATA] = await PublicKey.findProgramAddress(
      [Buffer.from("underlying"), vaultPDA.toBuffer()],
      vaultProgram.programId
    );
    console.log("Vault USDC ATA:", vaultUsdcATA.toBase58());

    // Derive strategy PDA
    const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        vaultPDA.toBuffer(),
        new BN(0).toArrayLike(Buffer, 'le', 8)
      ],
      strategyProgram.programId
    );
    console.log("Strategy PDA:", strategy.toBase58());

    // Derive strategy token account (underlying)
    const [strategyTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), strategy.toBuffer()],
      strategyProgram.programId
    );
    console.log("Strategy Token Account:", strategyTokenAccount.toBase58());

    // Derive strategyData PDA (for vault)
    const [strategyData] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("strategy_data"),
        vaultPDA.toBuffer(),
        strategy.toBuffer(),
      ],
      vaultProgram.programId
    );
    console.log("Strategy Data PDA:", strategyData.toBase58());

    // Derive token accounts for WSOL and TMAC
    const [strategyWSOLAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_account"),
        WSOL_MINT.toBuffer(),
        strategy.toBuffer(),
      ],
      strategyProgram.programId
    );
    console.log("Strategy WSOL Token Account:", strategyWSOLAccount.toBase58());

    const [strategyTMACAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_account"),
        TMAC_MINT.toBuffer(),
        strategy.toBuffer(),
      ],
      strategyProgram.programId
    );
    console.log("Strategy TMAC Token Account:", strategyTMACAccount.toBase58());

    // Derive Invest Tracker PDAs
    const [INVEST_TRACKER_ACCOUNT_WSOL] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("invest_tracker"),
        WSOL_MINT.toBuffer(),
        strategy.toBuffer(),
      ],
      strategyProgram.programId
    );
    console.log("Invest Tracker WSOL Account:", INVEST_TRACKER_ACCOUNT_WSOL.toBase58());

    const [INVEST_TRACKER_ACCOUNT_TMAC] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("invest_tracker"),
        TMAC_MINT.toBuffer(),
        strategy.toBuffer(),
      ],
      strategyProgram.programId
    );
    console.log("Invest Tracker TMAC Account:", INVEST_TRACKER_ACCOUNT_TMAC.toBase58());

    // ============================
    // Build remainingAccounts and remainingAccountsMap
    // ============================

    // For WSOL
    const remainingAccountsForWSOL = [
      {
        pubkey: WHIRLPOOL_PROGRAM_ID_WSOL, // index 0
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: WHIRLPOOL_ID_WSOL, // index 1
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyWSOLAccount, // index 2
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TOKEN_VAULT_A_WSOL, // index 3
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyTokenAccount, // index 4
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TOKEN_VAULT_B_WSOL, // index 5
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_WSOL[0], // index 6
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_WSOL[1], // index 7
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_WSOL[2], // index 8
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: ORACLE_ADDRESS_WSOL, // index 9
        isWritable: false,
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
      {
        pubkey: strategyData, // index 12
        isWritable: true,
        isSigner: false,
      },
    ];

    // For TMAC
    const remainingAccountsForTMAC = [
      {
        pubkey: WHIRLPOOL_PROGRAM_ID_TMAC, // index 13
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: WHIRLPOOL_ID_TMAC, // index 14
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyTMACAccount, // index 15
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TOKEN_VAULT_A_TMAC, // index 16
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyTokenAccount, // index 17
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TOKEN_VAULT_B_TMAC, // index 18
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_TMAC[0], // index 19
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_TMAC[1], // index 20
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: TICK_ARRAY_ADDRESSES_TMAC[2], // index 21
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: ORACLE_ADDRESS_TMAC, // index 22
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: INVEST_TRACKER_ACCOUNT_TMAC, // index 23
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategy, // index 24
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: strategyData, // index 25
        isWritable: true,
        isSigner: false,
      },
    ];

    // Combine remaining accounts
    const combinedRemainingAccounts = [...remainingAccountsForWSOL, ...remainingAccountsForTMAC];

    // Build remainingAccountsMap
    const remainingAccountsMap = {
      accountsMap: [
        {
          strategyAcc: new BN(11),
          strategyTokenAccount: new BN(4),
          strategyData: new BN(12),
          remainingAccounts: [
            new BN(0),
            new BN(1),
            new BN(2),
            new BN(3),
            new BN(4),
            new BN(5),
            new BN(6),
            new BN(7),
            new BN(8),
            new BN(9),
            new BN(10),
            new BN(11),
          ],
        },
        {
          strategyAcc: new BN(24),
          strategyTokenAccount: new BN(17),
          strategyData: new BN(25),
          remainingAccounts: [
            new BN(13),
            new BN(14),
            new BN(15),
            new BN(16),
            new BN(17),
            new BN(18),
            new BN(19),
            new BN(20),
            new BN(21),
            new BN(22),
            new BN(23),
            new BN(24),
          ],
        },
      ],
    };

    // ============================
    // Get User Shares Balance
    // ============================
    const userSharesBalanceInfo = await provider.connection.getTokenAccountBalance(userSharesATA);
    const userSharesBalance = new BN(userSharesBalanceInfo.value.amount);

    // Get and log initial balances
    const userUsdcBalanceBefore = await provider.connection.getTokenAccountBalance(userUsdcATA);
    console.log("User USDC balance before redemption:", userUsdcBalanceBefore.value.uiAmount);
    console.log("User Shares balance before redemption:", userSharesBalanceInfo.value.uiAmount);

    // Define redeemAmount and maxLoss
    const redeemAmount = userSharesBalance.div(new BN(2)); // Redeem half of the user's shares
    const maxLoss = new BN(500000); // Adjust as needed

    console.log(`Redeeming ${redeemAmount.toString()} shares with max loss ${maxLoss.toString()}`);

    // ============================
    // Create Lookup Table
    // ============================

    // Gather all unique public keys from combinedRemainingAccounts
    const addresses = combinedRemainingAccounts.map((acc) => acc.pubkey);

    // Create Lookup Table
    const lookupTableAddress = await createLookupTable(admin, provider.connection, addresses);

    // Wait for new block before using the lookup table
    await waitForNewBlock(provider.connection, 1);

    // Fetch the lookup table account
    const lookupTableAccount = (
      await provider.connection.getAddressLookupTable(lookupTableAddress)
    ).value;

    if (!lookupTableAccount) {
      throw new Error("Lookup table not found");
    }

    // ============================
    // Build the Versioned Transaction
    // ============================

    // Build the instruction for redeem
    const redeemIx = await vaultProgram.methods
      .redeem(redeemAmount, maxLoss, remainingAccountsMap)
      .accounts({
        vault: vaultPDA,
        userTokenAccount: userUsdcATA,
        userSharesAccount: userSharesATA,
        user: admin.publicKey,
      })
      .remainingAccounts(combinedRemainingAccounts)
      .instruction();

    // Now, we need to build a VersionedTransaction

    // Get the latest blockhash
    const latestBlockhash = await provider.connection.getLatestBlockhash();

    // Create a TransactionMessage
    const messageV0 = new TransactionMessage({
      payerKey: admin.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [redeemIx],
    }).compileToV0Message([lookupTableAccount]);

    // Create VersionedTransaction
    const transaction = new VersionedTransaction(messageV0);

    // Sign the transaction
    transaction.sign([admin]);

    // Send the transaction
    const txid = await provider.connection.sendTransaction(transaction);

    console.log("Redeem transaction executed successfully. Txid:", txid);

    // Wait for confirmation
    const confirmation = await provider.connection.confirmTransaction(txid, "confirmed");

    console.log("Transaction confirmed:", confirmation);

    // Fetch and log balances
    const userUsdcBalance = await provider.connection.getTokenAccountBalance(userUsdcATA);
    console.log("User USDC balance after redemption:", userUsdcBalance.value.uiAmount);

    const userSharesBalanceAfter = await provider.connection.getTokenAccountBalance(userSharesATA);
    console.log("User Shares balance after redemption:", userSharesBalanceAfter.value.uiAmount);

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

// Helper functions

async function createLookupTable(
  payer: Keypair,
  connection: Connection,
  addresses: PublicKey[],
): Promise<PublicKey> {
  // Get the current slot
  const slot = await connection.getSlot();

  // Create the lookup table creation instruction and retrieve its address
  const [lookupTableInst, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: payer.publicKey, // Account authorized to modify the LUT
      payer: payer.publicKey, // Account paying for transaction fees
      recentSlot: slot - 1, // Use a recent slot to derive the LUT address
    });

  console.log("Lookup Table Address:", lookupTableAddress.toBase58());

  // Create the instructions to extend the lookup table with the addresses
  const extendInstructions = [];
  const chunkSize = 30; // Max addresses per instruction to avoid exceeding tx size
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const chunk = addresses.slice(i, i + chunkSize);
    const extendInstruction = AddressLookupTableProgram.extendLookupTable({
      payer: payer.publicKey, // Account paying for transaction fees
      authority: payer.publicKey, // Account authorized to modify the lookup table
      lookupTable: lookupTableAddress, // Address of the lookup table to extend
      addresses: chunk, // Addresses to add to the lookup table
    });
    extendInstructions.push(extendInstruction);
  }

  // Send the transaction to create the lookup table and extend it
  const latestBlockhash = await connection.getLatestBlockhash();

  // Create the transaction message for creating the LUT
  const createMessage = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: [lookupTableInst],
  }).compileToV0Message();

  const createTransaction = new VersionedTransaction(createMessage);
  createTransaction.sign([payer]);

  const createTxid = await connection.sendTransaction(createTransaction);
  await connection.confirmTransaction(createTxid, "confirmed");

  // Extend the LUT
  for (const extendInstruction of extendInstructions) {
    const extendMessage = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [extendInstruction],
    }).compileToV0Message();

    const extendTransaction = new VersionedTransaction(extendMessage);
    extendTransaction.sign([payer]);

    const extendTxid = await connection.sendTransaction(extendTransaction);
    await connection.confirmTransaction(extendTxid, "confirmed");
  }

  return lookupTableAddress;
}

async function waitForNewBlock(
  connection: Connection,
  targetBlocks: number,
): Promise<void> {
  console.log(`Waiting for ${targetBlocks} new blocks...`);

  const initialSlot = await connection.getSlot();

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const currentSlot = await connection.getSlot();
      if (currentSlot >= initialSlot + targetBlocks) {
        clearInterval(interval);
        console.log(`New block(s) reached. Current slot: ${currentSlot}`);
        resolve();
      }
    }, 1000); // Check every second
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});