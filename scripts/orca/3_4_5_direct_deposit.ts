import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { Strategy } from "../../target/types/strategy";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  TransactionInstruction,
  AddressLookupTableAccount,
  SystemProgram,
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

// Token Mints
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const TMAC_MINT = new PublicKey("Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6");
const USDC_MINT = new PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k");
const USDT_MINT = new PublicKey("H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPm");
const SAMO_MINT = new PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa");

// Whirlpool constants for WSOL
const WHIRLPOOL_PROGRAM_ID_WSOL = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
const WHIRLPOOL_ID_WSOL = new PublicKey("3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt");
const TOKEN_VAULT_A_WSOL = new PublicKey("C9zLV5zWF66j3rZj3uuhDqvfuA8esJyWnruGzDW9qEj2");
const TOKEN_VAULT_B_WSOL = new PublicKey("7DM3RMz2yzUB8yPRQM3FMZgdFrwZGMsabsfsKopWktoX");
const TICK_ARRAY_ADDRESSES_WSOL = [
  new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
  new PublicKey("7knZZ461yySGbSEHeBUwEpg3VtAkQy8B9tp78RGgyUHE"),
  new PublicKey("CpoSFo3ajrizueggtJr2ZjvYgdtkgugXtvhqcwkyCkKP"),
];
const ORACLE_ADDRESS_WSOL = new PublicKey("2KEWNc3b6EfqoWQpfKQMHh4mhRyKXYRdPbtGRTJX3Cip");

// Whirlpool constants for TMAC
const WHIRLPOOL_PROGRAM_ID_TMAC = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
const WHIRLPOOL_ID_TMAC = new PublicKey("H3xhLrSEyDFm6jjG42QezbvhSxF5YHW75VdGUnqeEg5y");
const TOKEN_VAULT_A_TMAC = new PublicKey("2qE191zsJCJdMXsPcwkVJ5MyiSfreNpQtKpXgAMkwhUf");
const TOKEN_VAULT_B_TMAC = new PublicKey("G6qeUBPqU3Ryabi4rwVUgHpLh6wmHLvi8jDQexTR1CTU");
const TICK_ARRAY_ADDRESSES_TMAC = [
  new PublicKey("5NApkpCKADoeYk8s2SHa2u1nHBPEXr937c1amNgjMDdy"),
  new PublicKey("9ba9iZ82nymCD56GJRpDgeLBfH1p2mWn2djABosok3Bx"),
  new PublicKey("6Feg4gvgByuq4XZaoTJGJtM8HSmbWRirWPRM3wvcyP9P"),
];
const ORACLE_ADDRESS_TMAC = new PublicKey("34mJni6KtJBUWoqsT5yZUJ89ywHnYaU11bh27cNHPTov");

// Whirlpool constants for USDT
const WHIRLPOOL_PROGRAM_ID_USDT = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
const WHIRLPOOL_ID_USDT = new PublicKey("63cMwvN8eoaD39os9bKP8brmA7Xtov9VxahnPufWCSdg");
const TOKEN_VAULT_A_USDT = new PublicKey("FeBffJzs1FHzkBWb2g9d4BfCBZVfxSGUqxndUij4Dva3");
const TOKEN_VAULT_B_USDT = new PublicKey("5ETZXHhJmodgw7KPuNyKEvKhniGcxW99xS7VpZVbWvKH");
const TICK_ARRAY_ADDRESSES_USDT = [
  new PublicKey("EBHQcAfc4ncUkCxgGYxEWCSu744qFaBEBmyv3U9ajNzX"),
  new PublicKey("8Eh57hMUNffNpQPb4K2nQZFPguiYgnCSi2ehvtmuE2PA"),
  new PublicKey("FpGrraM6rZN1AkxMTyJrASda4q6BSdGJgqj544S1vcjL"),
];
const ORACLE_ADDRESS_USDT = new PublicKey("BMy2iNjiFUoVR3xLkaPjfEHXtwjvvS9Dja4mD4Yzh5Fw");

// Whirlpool constants for SAMO
const WHIRLPOOL_PROGRAM_ID_SAMO = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
const WHIRLPOOL_ID_SAMO = new PublicKey("EgxU92G34jw6QDG9RuTX9StFg1PmHuDqkRKAE5kVEiZ4");
const TOKEN_VAULT_A_SAMO = new PublicKey("GedZgiHw8dJpR6Fyt1PNgSwYznEyh18qgZvobuxYxMQ3");
const TOKEN_VAULT_B_SAMO = new PublicKey("4KDudC7XagDiZZbd9Xzabcy5yZMC8bvz7c8q7Bb9vXTa");
const TICK_ARRAY_ADDRESSES_SAMO = [
  new PublicKey("9H4aVdyXbnnmbSJLjYahvZzrgdHyWVMq8i1v1fD7jqBt"),
  new PublicKey("G13PKFAkn7rLHVT1fGbLPKAQFiMe6GiRKZ6e8ipxcn9q"),
  new PublicKey("76ntKkVqoLqakqHb6TdkWKuD9kNv2JbPL3k6EHudWHxd"),
];
const ORACLE_ADDRESS_SAMO = new PublicKey("3dWJWYaTPMoADQvVihAc8hFu4nYXsEtBAGQwPMBXau1t");

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
    const userUsdcATA = await getAssociatedTokenAddress(USDC_MINT, admin.publicKey);
    const userSharesATA = await token.getOrCreateAssociatedTokenAccount(
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

    // Get strategy token accounts for WSOL and TMAC
    const [strategyWSOLAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_account"), WSOL_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    const [strategyTMACAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_account"), TMAC_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    // Get strategy token accounts for USDT and SAMO
    const [strategyUSDTAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_account"), USDT_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    const [strategySAMOAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_account"), SAMO_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    // Get invest tracker PDAs
    const [INVEST_TRACKER_ACCOUNT_WSOL] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), WSOL_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    const [INVEST_TRACKER_ACCOUNT_TMAC] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), TMAC_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    const [INVEST_TRACKER_ACCOUNT_USDT] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), USDT_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    const [INVEST_TRACKER_ACCOUNT_SAMO] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), SAMO_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    // Get user data PDA
    const [userDataPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_data"),
        vaultPDA.toBuffer(),
        admin.publicKey.toBuffer()
      ],
      vaultProgram.programId
    );
    console.log("User Data PDA:", userDataPDA.toBase58());

    // Log initial balances
    const initialBalances = {
      userUsdc: await provider.connection.getTokenAccountBalance(userUsdcATA),
      userShares: await provider.connection.getTokenAccountBalance(userSharesATA.address),
      vaultUsdc: await provider.connection.getTokenAccountBalance(vaultUsdcATA),
      strategyUsdc: await provider.connection.getTokenAccountBalance(strategyTokenAccount),
      strategyWsol: await provider.connection.getTokenAccountBalance(strategyWSOLAccount),
      strategyTmac: await provider.connection.getTokenAccountBalance(strategyTMACAccount),
    };

    console.log("\nInitial Balances:");
    console.log("User USDC:", initialBalances.userUsdc.value.uiAmount);
    console.log("User Shares:", initialBalances.userShares.value.uiAmount);
    console.log("Vault USDC:", initialBalances.vaultUsdc.value.uiAmount);
    console.log("Strategy USDC:", initialBalances.strategyUsdc.value.uiAmount);
    console.log("Strategy WSOL:", initialBalances.strategyWsol.value.uiAmount);
    console.log("Strategy TMAC:", initialBalances.strategyTmac.value.uiAmount);

    // Add these to initial balance checks
    const strategyUsdtBalanceBefore = await provider.connection.getTokenAccountBalance(strategyUSDTAccount);
    const strategySamoBalanceBefore = await provider.connection.getTokenAccountBalance(strategySAMOAccount);

    // Add invest tracker data fetching for USDT and SAMO
    const investTrackerUSDTBefore = await strategyProgram.account.investTracker.fetch(
      INVEST_TRACKER_ACCOUNT_USDT
    );
    const investTrackerSAMOBefore = await strategyProgram.account.investTracker.fetch(
      INVEST_TRACKER_ACCOUNT_SAMO
    );

    console.log("Strategy USDT balance:", strategyUsdtBalanceBefore.value.uiAmount);
    console.log("Strategy SAMO balance:", strategySamoBalanceBefore.value.uiAmount);

    console.log("USDT Invest Tracker before:", {
      amountInvested: investTrackerUSDTBefore.amountInvested.toString(),
      amountWithdrawn: investTrackerUSDTBefore.amountWithdrawn.toString(),
      assetAmount: investTrackerUSDTBefore.assetAmount.toString(),
      assetPrice: investTrackerUSDTBefore.assetPrice.toString(),
      aToBForPurchase: investTrackerUSDTBefore.aToBForPurchase
    });

    console.log("SAMO Invest Tracker before:", {
      amountInvested: investTrackerSAMOBefore.amountInvested.toString(),
      amountWithdrawn: investTrackerSAMOBefore.amountWithdrawn.toString(),
      assetAmount: investTrackerSAMOBefore.assetAmount.toString(),
      assetPrice: investTrackerSAMOBefore.assetPrice.toString(),
      aToBForPurchase: investTrackerSAMOBefore.aToBForPurchase
    });

    // Build remaining accounts for both WSOL and TMAC swaps
    const remainingAccountsForWSOL = [
      { pubkey: WHIRLPOOL_PROGRAM_ID_WSOL, isWritable: false, isSigner: false }, // Whirlpool Program ID (index 0)
      { pubkey: WHIRLPOOL_ID_WSOL, isWritable: true, isSigner: false }, // Whirlpool ID (index 1)
      { pubkey: strategyWSOLAccount, isWritable: true, isSigner: false }, // token_owner_account_a (index 2)
      { pubkey: TOKEN_VAULT_A_WSOL, isWritable: true, isSigner: false }, // Token Vault A (index 3)
      { pubkey: strategyTokenAccount, isWritable: true, isSigner: false }, // token_owner_account_b (index 4)
      { pubkey: TOKEN_VAULT_B_WSOL, isWritable: true, isSigner: false }, // Token Vault B (index 5)
      ...TICK_ARRAY_ADDRESSES_WSOL.map(addr => ({ pubkey: addr, isWritable: true, isSigner: false })), // Tick Array Addresses (index 6-8)
      { pubkey: ORACLE_ADDRESS_WSOL, isWritable: true, isSigner: false }, // Oracle Address (index 9)
      { pubkey: INVEST_TRACKER_ACCOUNT_WSOL, isWritable: true, isSigner: false }, // Invest Tracker Account (index 10)
      { pubkey: strategy, isWritable: true, isSigner: false }, // Strategy PDA (index 11)
    ];

    const remainingAccountsForTMAC = [
      { pubkey: WHIRLPOOL_PROGRAM_ID_TMAC, isWritable: false, isSigner: false }, // Whirlpool Program ID (index 0)
      { pubkey: WHIRLPOOL_ID_TMAC, isWritable: true, isSigner: false }, // Whirlpool ID (index 1)
      { pubkey: strategyTMACAccount, isWritable: true, isSigner: false }, // token_owner_account_a (index 2)
      { pubkey: TOKEN_VAULT_A_TMAC, isWritable: true, isSigner: false }, // Token Vault A (index 3)
      { pubkey: strategyTokenAccount, isWritable: true, isSigner: false }, // token_owner_account_b (index 4)
      { pubkey: TOKEN_VAULT_B_TMAC, isWritable: true, isSigner: false }, // Token Vault B (index 5)
      ...TICK_ARRAY_ADDRESSES_TMAC.map(addr => ({ pubkey: addr, isWritable: true, isSigner: false })), // Tick Array Addresses (index 6-8)
      { pubkey: ORACLE_ADDRESS_TMAC, isWritable: true, isSigner: false }, // Oracle Address (index 9)
      { pubkey: INVEST_TRACKER_ACCOUNT_TMAC, isWritable: true, isSigner: false }, // Invest Tracker Account (index 10)
      { pubkey: strategy, isWritable: true, isSigner: false }, // Strategy PDA (index 11)
    ];

    const remainingAccountsForUSDT = [
      { pubkey: WHIRLPOOL_PROGRAM_ID_USDT, isWritable: false, isSigner: false }, // Whirlpool Program ID (index 0)
      { pubkey: WHIRLPOOL_ID_USDT, isWritable: true, isSigner: false }, // Whirlpool ID (index 1)
      { pubkey: strategyTokenAccount, isWritable: true, isSigner: false }, // token_owner_account_a (index 2)
      { pubkey: TOKEN_VAULT_A_USDT, isWritable: true, isSigner: false }, // Token Vault A (index 3)
      { pubkey: strategyUSDTAccount, isWritable: true, isSigner: false }, // token_owner_account_b (index 4)
      { pubkey: TOKEN_VAULT_B_USDT, isWritable: true, isSigner: false }, // Token Vault B (index 5)
      ...TICK_ARRAY_ADDRESSES_USDT.map(addr => ({ pubkey: addr, isWritable: true, isSigner: false })), // Tick Array Addresses (index 6-8)
      { pubkey: ORACLE_ADDRESS_USDT, isWritable: true, isSigner: false }, // Oracle Address (index 9)
      { pubkey: INVEST_TRACKER_ACCOUNT_USDT, isWritable: true, isSigner: false }, // Invest Tracker Account (index 10)
      { pubkey: strategy, isWritable: true, isSigner: false }, // Strategy PDA (index 11)
    ];

    const remainingAccountsForSAMO = [
      { pubkey: WHIRLPOOL_PROGRAM_ID_SAMO, isWritable: false, isSigner: false }, // Whirlpool Program ID (index 0)
      { pubkey: WHIRLPOOL_ID_SAMO, isWritable: true, isSigner: false }, // Whirlpool ID (index 1)
      { pubkey: strategySAMOAccount, isWritable: true, isSigner: false }, // token_owner_account_a (index 2)
      { pubkey: TOKEN_VAULT_A_SAMO, isWritable: true, isSigner: false }, // Token Vault A (index 3)
      { pubkey: strategyTokenAccount, isWritable: true, isSigner: false }, // token_owner_account_b (index 4)
      { pubkey: TOKEN_VAULT_B_SAMO, isWritable: true, isSigner: false }, // Token Vault B (index 5)
      ...TICK_ARRAY_ADDRESSES_SAMO.map(addr => ({ pubkey: addr, isWritable: true, isSigner: false })), // Tick Array Addresses (index 6-8)
      { pubkey: ORACLE_ADDRESS_SAMO, isWritable: true, isSigner: false }, // Oracle Address (index 9)
      { pubkey: INVEST_TRACKER_ACCOUNT_SAMO, isWritable: true, isSigner: false }, // Invest Tracker Account (index 10)
      { pubkey: strategy, isWritable: true, isSigner: false }, // Strategy PDA (index 11)
    ];

    // Combine remaining accounts
    const combinedRemainingAccounts = [...remainingAccountsForWSOL, ...remainingAccountsForTMAC, ...remainingAccountsForUSDT, ...remainingAccountsForSAMO];

    // Add lookup table generation
    // const addresses = combinedRemainingAccounts.map((acc) => acc.pubkey);
     // const lookupTableAddress = await createLookupTable(admin, provider.connection, addresses);
    // Read lookup table address from ALT.json
    const altJsonPath = path.join(__dirname, 'ALT', 'ALT.json');
    const altJson = JSON.parse(fs.readFileSync(altJsonPath, 'utf8'));
    //when there is just one lookup table
    // const lookupTableAddress = new PublicKey(altJson.lookupTableAddress);
    
    // await waitForNewBlock(provider.connection, 1);
    // const lookupTableAccount = (await provider.connection.getAddressLookupTable(lookupTableAddress)).value;
    // if (!lookupTableAccount) {
    //   throw new Error("Lookup table not found");
    // }
    // Load all lookup tables
    //when there is multiple lookup tables
    const lookupTableAccounts = await Promise.all(
      Object.values(altJson.lookupTableAddresses).map(async (address) => {
        const lookupTableAccount = (
          await provider.connection.getAddressLookupTable(new PublicKey(address))
        ).value;
        
        if (!lookupTableAccount) {
          throw new Error(`Lookup table not found for address: ${address}`);
        }
        return lookupTableAccount;
      })
    );

    console.log("Loaded lookup tables:", {
      programOperations: altJson.lookupTableAddresses.programOperations,
      poolOperations: altJson.lookupTableAddresses.poolOperations
    });

    // Define deposit amount (10 USDC)
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
        underlyingMint: USDC_MINT,
        userData: userDataPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(combinedRemainingAccounts)
      .instruction();

    // Create a TransactionMessage with all lookup tables
    const messageV0 = new TransactionMessage({
      payerKey: admin.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [computeUnitIx, computePriceIx, depositIx],
    // }).compileToV0Message([lookupTableAccount]); //when there is just one lookup table
    }).compileToV0Message(lookupTableAccounts); //when there is multiple lookup tables

    //let's console log lookup table accounts
    console.log("Lookup table accounts:", lookupTableAccounts);
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

    // Log final balances
    const finalBalances = {
      userUsdc: await provider.connection.getTokenAccountBalance(userUsdcATA),
      userShares: await provider.connection.getTokenAccountBalance(userSharesATA.address),
      vaultUsdc: await provider.connection.getTokenAccountBalance(vaultUsdcATA),
      strategyUsdc: await provider.connection.getTokenAccountBalance(strategyTokenAccount),
      strategyWsol: await provider.connection.getTokenAccountBalance(strategyWSOLAccount),
      strategyTmac: await provider.connection.getTokenAccountBalance(strategyTMACAccount),
    };

    console.log("\nFinal Balances:");
    console.log("User USDC:", finalBalances.userUsdc.value.uiAmount);
    console.log("User Shares:", finalBalances.userShares.value.uiAmount);
    console.log("Vault USDC:", finalBalances.vaultUsdc.value.uiAmount);
    console.log("Strategy USDC:", finalBalances.strategyUsdc.value.uiAmount);
    console.log("Strategy WSOL:", finalBalances.strategyWsol.value.uiAmount);
    console.log("Strategy TMAC:", finalBalances.strategyTmac.value.uiAmount);

    console.log("\nBalance Changes:");
    console.log("User USDC:", finalBalances.userUsdc.value.uiAmount! - initialBalances.userUsdc.value.uiAmount!);
    console.log("User Shares:", finalBalances.userShares.value.uiAmount! - initialBalances.userShares.value.uiAmount!);
    console.log("Vault USDC:", finalBalances.vaultUsdc.value.uiAmount! - initialBalances.vaultUsdc.value.uiAmount!);
    console.log("Strategy USDC:", finalBalances.strategyUsdc.value.uiAmount! - initialBalances.strategyUsdc.value.uiAmount!);
    console.log("Strategy WSOL:", finalBalances.strategyWsol.value.uiAmount! - initialBalances.strategyWsol.value.uiAmount!);
    console.log("Strategy TMAC:", finalBalances.strategyTmac.value.uiAmount! - initialBalances.strategyTmac.value.uiAmount!);

    // Add these to final balance checks
    const strategyUsdtBalanceAfter = await provider.connection.getTokenAccountBalance(strategyUSDTAccount);
    const strategySamoBalanceAfter = await provider.connection.getTokenAccountBalance(strategySAMOAccount);

    const investTrackerUSDTAfter = await strategyProgram.account.investTracker.fetch(
      INVEST_TRACKER_ACCOUNT_USDT
    );
    const investTrackerSAMOAfter = await strategyProgram.account.investTracker.fetch(
      INVEST_TRACKER_ACCOUNT_SAMO
    );

    console.log("Strategy USDT balance:", strategyUsdtBalanceAfter.value.uiAmount);
    console.log("Strategy SAMO balance:", strategySamoBalanceAfter.value.uiAmount);

    console.log("Strategy USDT change:", strategyUsdtBalanceAfter.value.uiAmount! - strategyUsdtBalanceBefore.value.uiAmount!);
    console.log("Strategy SAMO change:", strategySamoBalanceAfter.value.uiAmount! - strategySamoBalanceBefore.value.uiAmount!);

    console.log("USDT Invest Tracker after:", {
      amountInvested: investTrackerUSDTAfter.amountInvested.toString(),
      amountWithdrawn: investTrackerUSDTAfter.amountWithdrawn.toString(),
      assetAmount: investTrackerUSDTAfter.assetAmount.toString(),
      assetPrice: investTrackerUSDTAfter.assetPrice.toString(),
      aToBForPurchase: investTrackerUSDTAfter.aToBForPurchase
    });

    console.log("SAMO Invest Tracker after:", {
      amountInvested: investTrackerSAMOAfter.amountInvested.toString(),
      amountWithdrawn: investTrackerSAMOAfter.amountWithdrawn.toString(),
      assetAmount: investTrackerSAMOAfter.assetAmount.toString(),
      assetPrice: investTrackerSAMOAfter.assetPrice.toString(),
      aToBForPurchase: investTrackerSAMOAfter.aToBForPurchase
    });

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

// Add helper functions at the end of the file
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
      authority: payer.publicKey,
      payer: payer.publicKey,
      recentSlot: slot - 1,
    });

  console.log("Lookup Table Address:", lookupTableAddress.toBase58());

  // Create the instructions to extend the lookup table with the addresses
  const extendInstructions = [];
  const chunkSize = 30;
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const chunk = addresses.slice(i, i + chunkSize);
    const extendInstruction = AddressLookupTableProgram.extendLookupTable({
      payer: payer.publicKey,
      authority: payer.publicKey,
      lookupTable: lookupTableAddress,
      addresses: chunk,
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
