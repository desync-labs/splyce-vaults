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

// Token Mints
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const TMAC_MINT = new PublicKey("Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6");
const USDC_MINT = new PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k");

// Whirlpool constants for WSOL
const WHIRLPOOL_PROGRAM_ID_WSOL = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
const WHIRLPOOL_ID_WSOL = new PublicKey("3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt");
const TOKEN_VAULT_A_WSOL = new PublicKey("C9zLV5zWF66j3rZj3uuhDqvfuA8esJyWnruGzDW9qEj2");
const TOKEN_VAULT_B_WSOL = new PublicKey("7DM3RMz2yzUB8yPRQM3FMZgdFrwZGMsabsfsKopWktoX");
const TICK_ARRAY_ADDRESSES_WSOL = [
  new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
  new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
  new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
];
const ORACLE_ADDRESS_WSOL = new PublicKey("2KEWNc3b6EfqoWQpfKQMHh4mhRyKXYRdPbtGRTJX3Cip");

// Whirlpool constants for TMAC
const WHIRLPOOL_PROGRAM_ID_TMAC = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
const WHIRLPOOL_ID_TMAC = new PublicKey("H3xhLrSEyDFm6jjG42QezbvhSxF5YHW75VdGUnqeEg5y");
const TOKEN_VAULT_A_TMAC = new PublicKey("2qE191zsJCJdMXsPcwkVJ5MyiSfreNpQtKpXgAMkwhUf");
const TOKEN_VAULT_B_TMAC = new PublicKey("G6qeUBPqU3Ryabi4rwVUgHpLh6wmHLvi8jDQexTR1CTU");
const TICK_ARRAY_ADDRESSES_TMAC = [
  new PublicKey("5NApkpCKADoeYk8s2SHa2u1nHBPEXr937c1amNgjMDdy"),
  new PublicKey("5NApkpCKADoeYk8s2SHa2u1nHBPEXr937c1amNgjMDdy"),
  new PublicKey("5NApkpCKADoeYk8s2SHa2u1nHBPEXr937c1amNgjMDdy"),
];
const ORACLE_ADDRESS_TMAC = new PublicKey("34mJni6KtJBUWoqsT5yZUJ89ywHnYaU11bh27cNHPTov");

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

    // Get invest tracker PDAs
    const [INVEST_TRACKER_ACCOUNT_WSOL] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), WSOL_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

    const [INVEST_TRACKER_ACCOUNT_TMAC] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("invest_tracker"), TMAC_MINT.toBuffer(), strategy.toBuffer()],
      strategyProgram.programId
    );

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

    // Combine remaining accounts
    const combinedRemainingAccounts = [...remainingAccountsForWSOL, ...remainingAccountsForTMAC];

    // Execute direct deposit
    const depositAmount = new BN(10).mul(new BN(10).pow(new BN(6))); // 10 USDC

    // Set compute unit limit
    const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300_000,
    });

    // Set compute unit price
    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    await vaultProgram.methods
      .directDeposit(depositAmount)
      .accounts({
        vault: vaultPDA,
        userTokenAccount: userUsdcATA,
        userSharesAccount: userSharesATA.address,
        strategy: strategy,
        user: admin.publicKey,
      })
      .remainingAccounts(combinedRemainingAccounts)
      .preInstructions([computeUnitIx, computePriceIx])
      .signers([admin])
      .rpc();

    console.log("\nDirect deposit completed successfully!");

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
