import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../target/types/tokenized_vault";
import { StrategyProgram } from "../target/types/strategy_program";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as borsh from 'borsh';
import { TradeFintechConfig, TradeFintechConfigSchema } from "../tests/utils/schemas";
import * as fs from 'fs'; // Import fs module
import * as path from 'path'; // Import path module

const METADATA_SEED = "metadata";
const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// Define the config function
async function main() {
  try {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const secretKeyPath = path.resolve(process.env.HOME, '.config/solana/mainnet.json');
    const secretKeyString = fs.readFileSync(secretKeyPath, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const admin = anchor.web3.Keypair.fromSecretKey(secretKey);

    const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
    const strategyProgram = anchor.workspace.StrategyProgram as Program<StrategyProgram>;

    const underlyingMint = new anchor.web3.PublicKey("4N37FD6SU35ssX6yTu2AcCvzVbdS6z3YZTtk5gv7ejhE");
    console.log("Underlying token mint public key:", underlyingMint.toBase58());

    const vault_index = 2;

    const vault = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(vault_index)]).buffer))
      ],
      vaultProgram.programId
    )[0];

    const sharesMint = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vault.toBuffer()],
      vaultProgram.programId
    )[0];

    const config = {
      name: "Share Splyce USD",
      symbol: "sstUSD",
      uri: "https://gist.githubusercontent.com/vito-kovalione/a3fcf481b0cced2615ae626ebdd04288/raw/f6a648dfebce511448c81ea5b4672bdd9f14c2e2/gistfile1.txt",
      depositLimit: new BN(1_000_000_000).mul(new BN(10).pow(new BN(9))),
      minUserDeposit: new BN(0),
      performanceFee: new BN(1000),
      profitMaxUnlockTime: new BN(0),
    };

    const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        sharesMint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    await vaultProgram.methods.initVault(new BN(vault_index), config)
      .accounts({
        metadata: metadataAddress,
        underlyingMint,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Vault:", vault.toBase58());

    const strategy = anchor.web3.PublicKey.findProgramAddressSync(
      [
        vault.toBuffer(),
        Buffer.from(new Uint8Array([0]))
      ],
      strategyProgram.programId
    )[0];


    //TODO: Depoit and lock period ends in 30 minutes
  // deposit period end -> 1728568800 -> Thursday, October 10, 2024 6:00:00 PM GMT+04:00
  // lock period end -> 1728655200 -> Friday, October 11, 2024 6:00:00 PM GMT+04:00
    const strategyType = { tradeFintech: {} };
    const strategyConfig = new TradeFintechConfig({
      depositLimit: new BN(1000),
      // deposit ends in 1 minute, epoch time in seconds
      depositPeriodEnds: new BN(1728568800), //Date.now() / 1000 + 60 * 30),
      // lock period ends in 2 minute
      lockPeriodEnds: new BN(1728655200),//Date.now() / 1000 + 2 * 60 * 30),
      performanceFee: new BN(1),
      feeManager: admin.publicKey
    });

    const configBytes = Buffer.from(borsh.serialize(TradeFintechConfigSchema, strategyConfig));
    console.log("strategy:", strategy);
    await strategyProgram.methods.initStrategy(0, strategyType, configBytes)
      .accounts({
        underlyingMint,
        vault,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();
  
    console.log("Strategy:", strategy.toBase58());

    await vaultProgram.methods.addStrategy(new BN(1000000000))
      .accounts({
        vault,
        strategy,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Strategy added to vault");
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

// Run the config function
main().catch((err) => {
  console.error(err);
  process.exit(1);
});