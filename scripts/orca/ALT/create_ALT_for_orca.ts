import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../../../target/types/tokenized_vault";
import { Strategy } from "../../../target/types/strategy";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
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

// ============================================================================
// Part 1: Address Definitions
// ============================================================================

// Shared Whirlpool Program ID
const ORCA_WHIRLPOOL_PROGRAM_ID = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");

// Token Mints
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const TMAC_MINT = new PublicKey("Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6");
const USDC_MINT = new PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k");
const USDT_MINT = new PublicKey("H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPm");
const SAMO_MINT = new PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa");

// Define interface for pool configuration
interface PoolConfig {
  name: string;
  poolId: PublicKey;
  vaultA: PublicKey;
  vaultB: PublicKey;
  strategyAssetAccount: PublicKey;  // Generated via init_token_account
  investTracker: PublicKey;         // PDA for tracking investments
  tickArrays: PublicKey[];
  oracle: PublicKey;
}

// Constants for PDA seeds
const TOKEN_ACCOUNT_SEED = "token_account";
const INVEST_TRACKER_SEED = "invest_tracker";
const UNDERLYING_SEED = "underlying";


// Calculate PDAs for strategy accounts
async function calculateStrategyAccounts(strategy: PublicKey, strategyProgram: Program<Strategy>) {
  // Calculate shared strategy token account (for USDC - underlying asset)
  const [strategyTokenAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(UNDERLYING_SEED),
      strategy.toBuffer()
    ],
    strategyProgram.programId
  );

  // Calculate strategy asset accounts for each token
  const [strategyWSOLAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(TOKEN_ACCOUNT_SEED),
      WSOL_MINT.toBuffer(),
      strategy.toBuffer()
    ],
    strategyProgram.programId
  );

  const [strategyTMACAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(TOKEN_ACCOUNT_SEED),
      TMAC_MINT.toBuffer(),
      strategy.toBuffer()
    ],
    strategyProgram.programId
  );

  const [strategyUSDTAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(TOKEN_ACCOUNT_SEED),
      USDT_MINT.toBuffer(),
      strategy.toBuffer()
    ],
    strategyProgram.programId
  );

  const [strategySAMOAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(TOKEN_ACCOUNT_SEED),
      SAMO_MINT.toBuffer(),
      strategy.toBuffer()
    ],
    strategyProgram.programId
  );

  // Calculate invest trackers for each asset
  const [investTrackerWSOL] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(INVEST_TRACKER_SEED),
      WSOL_MINT.toBuffer(),
      strategy.toBuffer()
    ],
    strategyProgram.programId
  );

  const [investTrackerTMAC] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(INVEST_TRACKER_SEED),
      TMAC_MINT.toBuffer(),
      strategy.toBuffer()
    ],
    strategyProgram.programId
  );

  const [investTrackerUSDT] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(INVEST_TRACKER_SEED),
      USDT_MINT.toBuffer(),
      strategy.toBuffer()
    ],
    strategyProgram.programId
  );

  const [investTrackerSAMO] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(INVEST_TRACKER_SEED),
      SAMO_MINT.toBuffer(),
      strategy.toBuffer()
    ],
    strategyProgram.programId
  );

  return {
    strategyTokenAccount,
    strategyAssetAccounts: {
      WSOL: strategyWSOLAccount,
      TMAC: strategyTMACAccount,
      USDT: strategyUSDTAccount,
      SAMO: strategySAMOAccount
    },
    investTrackers: {
      WSOL: investTrackerWSOL,
      TMAC: investTrackerTMAC,
      USDT: investTrackerUSDT,
      SAMO: investTrackerSAMO
    }
  };
}

// Update the pool configurations with the calculated PDAs
async function updatePoolConfigs(strategy: PublicKey, strategyProgram: Program<Strategy>): Promise<PoolConfig[]> {
  const accounts = await calculateStrategyAccounts(strategy, strategyProgram);
  
  return [
    {
      name: "WSOL-USDC",
      poolId: new PublicKey("3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt"),
      vaultA: new PublicKey("C9zLV5zWF66j3rZj3uuhDqvfuA8esJyWnruGzDW9qEj2"),
      vaultB: new PublicKey("7DM3RMz2yzUB8yPRQM3FMZgdFrwZGMsabsfsKopWktoX"),
      strategyAssetAccount: accounts.strategyAssetAccounts.WSOL,
      investTracker: accounts.investTrackers.WSOL,
      tickArrays: [
        new PublicKey("DNA1RGNjuFi7bJKLAc1wLw4Np4z4472bpsv1mT6wQVVs"),
        new PublicKey("3XbmuaJoxStJT8SxQmczjyYhANzcqPMxa9dxmP9w6eXV"),
        new PublicKey("3rC87MFCC7VKpkhAR5gp2zMBjHr46jRajvMHxCBF8MWr"),
        new PublicKey("GsCSnitrDbtw5m8UzPsmwb3Tr3R3DYmpz4WzhTriWri"),
        new PublicKey("9LkTLtZ4LyXDeZDYvABFMkjTH3eBAie6fhKKsCm3Wzbr"),
        new PublicKey("EqtTNVtnHTkTjMHuXZNmJSSPC34NSZ1xq7a8TdM9ZgMj"),
        new PublicKey("9iGzy4mQtJadZDuH8seBFQGiqcb6wyp2KW4M6NKHvsAW"),
        new PublicKey("CpoSFo3ajrizueggtJr2ZjvYgdtkgugXtvhqcwkyCkKP"),
        new PublicKey("7knZZ461yySGbSEHeBUwEpg3VtAkQy8B9tp78RGgyUHE"),
        new PublicKey("3aBJJLAR3QxGcGsesNXeW3f64Rv3TckF7EQ6sXtAuvGM"),
        new PublicKey("A1vrG379E5ttoaWmyQBiunsMdyrpoUp7mSQwu8DgLcip"),
        new PublicKey("6457MVShLFLePXXpyj2uwL2P23wkraT4QnP5u5orTRDU"),
        new PublicKey("yw1zGndYDaEkdfYTzXBbcGDwZxGK1ocwxC5gHQTosz6"),
        new PublicKey("8t8Hgu5ffhMgpgoU31BfmGL4fLV7XAzihWr8A1BqwQNf"),
        new PublicKey("GFhy1BZJJQGPC4NRgAzjnVh2q5eKb61VqsuXsGZ8Eo1p"),
        new PublicKey("4auQhyGCLPeE51z5jBBEDXCR6iKtyYCsu2kCyfRq9f2k"),
        new PublicKey("DAvMXvQoS6jdcfETgsA2ULfjDqLQkUCD8iKhXHBvt7J2"),
        new PublicKey("DJiX7WJAVrnm4huTzZZBymjDdnVP6cL3ZgdMkuB8AmTH"),
        new PublicKey("J5t5PW4EhNAthjaSJ9yZrt4137wa3YsdL1oiynb7nb1x"),
      ],
      oracle: new PublicKey("2KEWNc3b6EfqoWQpfKQMHh4mhRyKXYRdPbtGRTJX3Cip"),
    },
    {
      name: "TMAC-USDC",
      poolId: new PublicKey("H3xhLrSEyDFm6jjG42QezbvhSxF5YHW75VdGUnqeEg5y"),
      vaultA: new PublicKey("2qE191zsJCJdMXsPcwkVJ5MyiSfreNpQtKpXgAMkwhUf"),
      vaultB: new PublicKey("G6qeUBPqU3Ryabi4rwVUgHpLh6wmHLvi8jDQexTR1CTU"),
      strategyAssetAccount: accounts.strategyAssetAccounts.WSOL,
      investTracker: accounts.investTrackers.WSOL,
      tickArrays: [
        new PublicKey("FSdebMGcqM8pAA14nfZiMvXP5JmWLmuSDdq6fns6Zq4W"),
        new PublicKey("5cH8Ca4ok6GqQaX56xMCr4P496eauXVE8PFxuTPoaoSk"),
        new PublicKey("UiZEkaN2SbmyvzBkU1arhhpFB5k8etU9cexKNxSw9iY"),
        new PublicKey("88T4ywo1ouNy3mihenWiEyj6nVoBtMxo9LgBtnZqyUwn"),
        new PublicKey("2aGLarneNz63qVKBQSE5GPcWPrzK23r7JHoByNSNycT7"),
        new PublicKey("9YB2qdtvnAoEpHMuCN86C4stkszRo7CuLT5qjc9v4Dea"),
        new PublicKey("V5Lj1z3Pj6cyA2WXtsoVxuRQgAE46zRbzVvcjBEsWAW"),
        new PublicKey("6Feg4gvgByuq4XZaoTJGJtM8HSmbWRirWPRM3wvcyP9P"),
        new PublicKey("9ba9iZ82nymCD56GJRpDgeLBfH1p2mWn2djABosok3Bx"),
        new PublicKey("5NApkpCKADoeYk8s2SHa2u1nHBPEXr937c1amNgjMDdy"),
        new PublicKey("GLsD5jys1yN9oFuvXPWkgWcTMXytRRHtUpaytdpoEkEz"),
        new PublicKey("6tWqaXhC6DzL3qF3C7jqd4fp8GfZ4eZ81HaZxP1q42FF"),
        new PublicKey("CjCq55p6PRp5So1tCspyfxSnSHcq4D4Nzjdv42yQ1GUs"),
        new PublicKey("Yartq9agho1PGKLxf3PkcGR3Qk9jmAsFbw9aQoaUemm"),
        new PublicKey("4k5eKc5MsFvD9DQxKCvAnfWTZ2hwnYjFCMuUYxcNPzzf"),
        new PublicKey("H4eH33qVCHUmWAuRM852FAuFgBDjrnjB8tJoYWdYL64j"),
        new PublicKey("9GsxUYfBYRd1VWakLD4MuivD1pbPj8R1LU4zxNdojSNF"),
        new PublicKey("BLzfkqw9ydbmQ4zmfiVxNzBnRRpsa9vwZWtNWCQ137sR"),
        new PublicKey("35f3wQa4qkPy27Ehmo2miYjzUeu5itYMJrkj9R26SVQh"),
      ],
      oracle: new PublicKey("34mJni6KtJBUWoqsT5yZUJ89ywHnYaU11bh27cNHPTov"),
    },
    {
      name: "USDC-USDT",
      poolId: new PublicKey("63cMwvN8eoaD39os9bKP8brmA7Xtov9VxahnPufWCSdg"),
      vaultA: new PublicKey("FeBffJzs1FHzkBWb2g9d4BfCBZVfxSGUqxndUij4Dva3"),
      vaultB: new PublicKey("5ETZXHhJmodgw7KPuNyKEvKhniGcxW99xS7VpZVbWvKH"),
      strategyAssetAccount: accounts.strategyAssetAccounts.WSOL,
      investTracker: accounts.investTrackers.WSOL,
      tickArrays: [
        new PublicKey("999VP1mSVxakMuFm8WJAcbTFUzLMuaNQ6kiNihR3xzVb"),
        new PublicKey("3NyZ8mt7YgKe8dAqSoX1d1f2DFVxmxbxAf7mgetPgSmV"),
        new PublicKey("DSn5N7TFFyLVfaSgpHtxgM9CAcX6gu5Hdh9EtcKQoJP6"),
        new PublicKey("HauHB7MG4WGvwGuFrEBaKf9EcFTHmbeeDgGBFncP2Ywg"),
        new PublicKey("HadgHkoz3tNDZLGfXSw1jfffLk3qev2V1kTzDB7SgoTc"),
        new PublicKey("7hZGP2bQZjbTKCYearYR7zkVUx4ag1kn3CZ13RngJfAZ"),
        new PublicKey("47mWJhHjh38zhFcDskCFzsuFsQT2pSjo5XnLHZYQX1WA"),
        new PublicKey("HZUZhi5xeybSiKJqBu1XXRh4y9azNLNSdgQ7owyarzQ"),
        new PublicKey("4cCMLotR9ATrdxznfA6uJjySPJ96yEqzqUejxVxHrV9x"),
        new PublicKey("EBHQcAfc4ncUkCxgGYxEWCSu744qFaBEBmyv3U9ajNzX"),
        new PublicKey("8Eh57hMUNffNpQPb4K2nQZFPguiYgnCSi2ehvtmuE2PA"),
        new PublicKey("FpGrraM6rZN1AkxMTyJrASda4q6BSdGJgqj544S1vcjL"),
        new PublicKey("6Wtv7zQs8nmQBot8eTT7h3DifLQaJLaUsykj2zpSSdPA"),
        new PublicKey("3xBGLqdvSDqvXxUm9gbSmiZQdRxn5vSqa3BA3sDhBscK"),
        new PublicKey("GNu2mVDSdhUw3r7phNogQrvqm2q63G33RKkGBYkqEXCx"),
        new PublicKey("NkQv5xUBxmQdspuPRD1yG29WW9D2XG73NEWyYfKdJ1K"),
        new PublicKey("GSrq9A8LPEpTqD5ffumTC9bRoD65Gpczk9M3kokA1Qkk"),
        new PublicKey("ERJXMH6S1RAbceTHEytEgiUuiBostRAxLknUJHWAA9Pn"),
        new PublicKey("BP3xmbFKh2LTexZauTavPwK1YjkVjDiA44vCRtcCAhFJ"),
      ],
      oracle: new PublicKey("BMy2iNjiFUoVR3xLkaPjfEHXtwjvvS9Dja4mD4Yzh5Fw"),
    },
    {
      name: "SAMO-USDC",
      poolId: new PublicKey("EgxU92G34jw6QDG9RuTX9StFg1PmHuDqkRKAE5kVEiZ4"),
      vaultA: new PublicKey("GedZgiHw8dJpR6Fyt1PNgSwYznEyh18qgZvobuxYxMQ3"),
      vaultB: new PublicKey("4KDudC7XagDiZZbd9Xzabcy5yZMC8bvz7c8q7Bb9vXTa"),
      strategyAssetAccount: accounts.strategyAssetAccounts.WSOL,
      investTracker: accounts.investTrackers.WSOL,
      tickArrays: [
        new PublicKey("E2ectcU2gw5ZZCL5d5qTENvHY8QVJuX4Dw4b49THNgju"),
        new PublicKey("7haRsT2fiYSru8rz7T6KvCr3r3haJFcLMxKSvy5uHkBD"),
        new PublicKey("6jQGzzhSURg6h73MEAoMENbQy7pguYj65MRo2VhWUpBz"),
        new PublicKey("Ab1K8ciwjSyZ6JzeFq7DLuLYFRtKxSSA4tEkMobVyZVd"),
        new PublicKey("EKNvbYkSVvfmryqkodnKV2DSicPPkc7hGekiCBmCZKFF"),
        new PublicKey("BDaAjRNeEGUpUrjynBtJJnsbVS2oeyXQXCEU8bwn9hid"),
        new PublicKey("HCawgRPFGdgBcnziz5Xy9cAg6YjuS12nAXjjrnRqUbY5"),
        new PublicKey("76ntKkVqoLqakqHb6TdkWKuD9kNv2JbPL3k6EHudWHxd"),
        new PublicKey("G13PKFAkn7rLHVT1fGbLPKAQFiMe6GiRKZ6e8ipxcn9q"),
        new PublicKey("9H4aVdyXbnnmbSJLjYahvZzrgdHyWVMq8i1v1fD7jqBt"),
        new PublicKey("B6n4APQbms1BdY5Ev1V9hjgz3NC94f7ws8qG9e3bpedE"),
        new PublicKey("9AQxHkiVJqoXRUvP9FpoXUcZ1HCEHpJHp8eZVRocK7Wx"),
        new PublicKey("beSZSvEcPG3GMsSpgqD4NDXHSAbBVd4rTQ1Nc9p9Quc"),
        new PublicKey("Bm63b4EQJBp8y2tvPUzpZxeeFyRWHTc4ZGhJdW5C96c6"),
        new PublicKey("NiZbevEskkjPoh6KDxg2sUPmbzSq4W5zCF8kw6W52SZ"),
        new PublicKey("8V6XnBoPhE1BXAWxuYeiZcpftuNev8TfwTqRTi21pCnM"),
        new PublicKey("HXmzNUrMHeWQcrikVmqox86mYFrdkrWKT94GHHTtRoMQ"),
        new PublicKey("FZYGGL3UPXGdKBwjgHy6RobDcKDMMZworD2pjcGEycwz"),
        new PublicKey("HeHu8D4ScAYEb6RHrnMmqMNET9RMh3mo6rWi6Ri9tZAo"),
      ],
      oracle: new PublicKey("3dWJWYaTPMoADQvVihAc8hFu4nYXsEtBAGQwPMBXau1t"),
    },
  ];
}

// ============================================================================
// Part 2: ALT Creation Functions
// ============================================================================

async function main() {
  try {
    // 1. Setup Provider and Programs
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // Load admin keypair
    const secretKeyPath = path.resolve(process.env.HOME!, ".config/solana/id.json");
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(secretKeyPath, 'utf8')));
    const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

    const connection = provider.connection;

    // 2. Setup Programs
    const strategyProgram = anchor.workspace.Strategy as Program<Strategy>;
    const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;

    // 3. Get PDAs
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      vaultProgram.programId
    );

    const [strategy] = PublicKey.findProgramAddressSync(
      [
        vaultPDA.toBuffer(),
        new BN(0).toArrayLike(Buffer, "le", 8)
      ],
      strategyProgram.programId
    );

    // Add strategyData PDA calculation
    const [strategyData] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("strategy_data"),
        vaultPDA.toBuffer(),
        strategy.toBuffer(),
      ],
      vaultProgram.programId
    );
    console.log("Strategy Data PDA:", strategyData.toBase58());

    // 4. Get pool configurations with calculated PDAs
    const pools = await updatePoolConfigs(strategy, strategyProgram);
    
    // 5. Collect all addresses that need to be added to the lookup table
    const addresses = [
      ORCA_WHIRLPOOL_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      strategyData, // Add strategyData to lookup table addresses
      ...pools.flatMap(pool => [
        pool.poolId,
        pool.vaultA,
        pool.vaultB,
        pool.strategyAssetAccount,
        pool.investTracker,
        ...pool.tickArrays,
        pool.oracle,
      ])
    ];

    // 6. Log address summary for verification
    console.log("\nAddress Summary:");
    console.log("Program IDs:");
    console.log("- Orca Whirlpool:", ORCA_WHIRLPOOL_PROGRAM_ID.toBase58());
    console.log("- Token Program:", TOKEN_PROGRAM_ID.toBase58());
    
    pools.forEach(pool => {
      console.log(`\n${pool.name} Pool:`);
      console.log("Pool ID:", pool.poolId.toBase58());
      console.log("Vault A:", pool.vaultA.toBase58());
      console.log("Vault B:", pool.vaultB.toBase58());
      console.log("Strategy Asset Account:", pool.strategyAssetAccount.toBase58());
      console.log("Invest Tracker:", pool.investTracker.toBase58());
      console.log("Tick Arrays:", pool.tickArrays.map(ta => ta.toBase58()));
      console.log("Oracle:", pool.oracle.toBase58());
    });

    console.log("\nTotal addresses to add:", addresses.length);

    // 7. Create and extend lookup table
    const slot = await connection.getSlot();
    const [createIx, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
      authority: admin.publicKey,
      payer: admin.publicKey,
      recentSlot: slot
    });

    // Create the lookup table
    console.log("\nCreating lookup table...");
    const transaction = new anchor.web3.Transaction();
    transaction.add(createIx);
    await sendAndConfirmTransaction(
      connection,
      transaction,
      [admin]
    );

    // Wait for a new block to ensure the lookup table is confirmed
    await waitForNewBlock(connection, 1);
    console.log("Lookup table creation confirmed with new block.");

    // Extend the table with addresses in chunks
    console.log("Extending lookup table with addresses...");
    const chunkSize = 20; // Process in smaller chunks to avoid tx size limits
    for (let i = 0; i < addresses.length; i += chunkSize) {
      const chunk = addresses.slice(i, Math.min(i + chunkSize, addresses.length));
      const extendIx = AddressLookupTableProgram.extendLookupTable({
        payer: admin.publicKey,
        authority: admin.publicKey,
        lookupTable: lookupTableAddress,
        addresses: chunk
      });

      await sendAndConfirmTransaction(
        connection,
        new anchor.web3.Transaction().add(extendIx),
        [admin]
      );

      console.log(`Added addresses ${i + 1} to ${i + chunk.length}`);
      
      // Wait for a new block after each extension
      await waitForNewBlock(connection, 1);
    }

    // Wait for final confirmation before saving
    await waitForNewBlock(connection, 1);
    console.log("All extensions confirmed with new block.");

    // 8. Save the lookup table address
    const altJson = {
      lookupTableAddress: lookupTableAddress.toBase58()
    };
    
    const currentDir = __dirname;
    const altJsonPath = path.join(currentDir, 'ALT.json');
    
    fs.writeFileSync(altJsonPath, JSON.stringify(altJson, null, 2));
    console.log(`\nLookup table created successfully!`);
    console.log(`Address: ${lookupTableAddress.toBase58()}`);
    console.log(`Saved to: ${altJsonPath}`);

  } catch (error) {
    console.error("Error occurred:", error);
    if ('logs' in error) {
      console.error("Program Logs:", error.logs);
    }
  }
}

main().catch(console.error);

// Add helper functions at the end of the file
async function waitForNewBlock(
  connection: Connection,
  targetBlocks: number,
): Promise<void> {
  console.log(`Waiting for ${targetBlocks} new block(s)...`);

  const initialSlot = await connection.getSlot();

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const currentSlot = await connection.getSlot();
        if (currentSlot >= initialSlot + targetBlocks) {
          clearInterval(interval);
          console.log(`New block(s) reached. Current slot: ${currentSlot}`);
          resolve();
        }
      } catch (error) {
        console.error("Error while fetching slot:", error);
        clearInterval(interval);
        resolve(); // Resolve to prevent hanging in case of error
      }
    }, 1000); // Check every second
  });
}
