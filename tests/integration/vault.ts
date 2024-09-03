import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { Strategy } from "../target/types/strategy";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as borsh from 'borsh';
import * as assert from 'assert';
import { SimpleStrategySchema, SimpleStrategy } from "../utils/schemas";


describe("tokenized_vault", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
  const strategyProgram = anchor.workspace.StrategyProgram as Program<Strategy>;
  const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  let vault: anchor.web3.PublicKey;
  let sharesMint: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  let vaultTokenAccount: anchor.web3.PublicKey;
  let strategyTokenAccount: anchor.web3.PublicKey;
  let userSharesAccount: anchor.web3.PublicKey;
  let strategy: anchor.web3.PublicKey;
  let user: anchor.web3.Keypair;
  let admin: anchor.web3.Keypair;
  let underlyingMint: anchor.web3.PublicKey;
  // let strategyData: anchor.web3.PublicKey;

  before(async () => {
    user = anchor.web3.Keypair.generate();
    admin = anchor.web3.Keypair.generate();

    console.log("Admin public key:", admin.publicKey.toBase58());
    console.log("User public key:", user.publicKey.toBase58());
    console.log("Program ID:", vaultProgram.programId.toBase58());
    console.log("Strategy Program ID:", strategyProgram.programId.toBase58());

    // Airdrop SOL to the user
    const provider = anchor.AnchorProvider.env();
    const airdropSignature = await provider.connection.requestAirdrop(user.publicKey, 10e9);
    const airdropSignature2 = await provider.connection.requestAirdrop(admin.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);
    await provider.connection.confirmTransaction(airdropSignature2);
    
    console.log("Airdropped 1 SOL to user:", user.publicKey.toBase58());

    underlyingMint = await token.createMint(provider.connection, admin, admin.publicKey, null, 18);
    console.log("Token mint public key:", underlyingMint.toBase58());

    vault = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"), 
        underlyingMint.toBuffer(), 
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(1)]).buffer))
      ],
      vaultProgram.programId
    )[0];
    console.log("Vault PDA:", vault.toBase58());

    sharesMint = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vault.toBuffer()], 
      vaultProgram.programId
    )[0];
    console.log("Shares sharesMintDerived public key:", sharesMint.toBase58());
    console.log("vaultProgram.programId:", vaultProgram.programId.toBase58());

    vaultTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), vault.toBuffer()], 
      vaultProgram.programId,
    )[0];
    console.log("Vault token account:", vaultTokenAccount.toBase58());
  });

  it("Initializes the vault", async () => {
    await vaultProgram.methods.initialize(new BN(1))
      .accounts({
        vault,
        sharesMint,
        tokenAccount : vaultTokenAccount,
        underlyingMint,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();

    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.ok(vaultAccount.underlyingTokenAcc.equals(vaultTokenAccount));
  });

  it("Initializes the strategy", async () => {
    strategy = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("simple"), vault.toBuffer()],
      strategyProgram.programId
    )[0];

    strategyTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
      [strategy.toBuffer(), Buffer.from("underlying")],
      strategyProgram.programId,
    )[0];

    const strategyType = { simple: {} };

    const config = new SimpleStrategy({
      depositLimit: new BN(1000),
      // Add other fields as needed
    });
    const configBytes = Buffer.from(borsh.serialize(SimpleStrategySchema, config));
    console.log("strategy:", strategy);
    await strategyProgram.methods.initialize(strategyType, configBytes)
      .accounts({
        strategy,
        tokenAccount: strategyTokenAccount,
        underlyingMint,
        vault,
        admin: admin.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    console.log("Strategy public key:", strategy.toBase58());

    // console.log(await strategyProgram.account.simpleStrategy.fetch(strategy));
    const strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.ok(strategyAccount.depositLimit.eq(new BN(1000)));

  });

  it("Adds a strategy to the vault", async () => {
    // strategyData = anchor.web3.PublicKey.findProgramAddressSync(
    //   [Buffer.from("strategy"), vault.toBuffer(), strategy.toBuffer()],
    //   vaultProgram.programId
    // )[0];

    await vaultProgram.methods.addStrategy(new BN(1000000000))
      .accounts({
        // strategyData,
        vault,
        strategy,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // get the vault strategies
    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.ok(vaultAccount.strategies[0].key.equals(strategy));
  });

  it("Deposits tokens into the vault", async () => {
    const provider = anchor.AnchorProvider.env();

    userTokenAccount = await token.createAccount(provider.connection, user, underlyingMint, user.publicKey);
    console.log("User token account:", userTokenAccount.toBase58());

    userSharesAccount = await token.createAccount(provider.connection, user, sharesMint, user.publicKey);
    console.log("User shares account:", userSharesAccount.toBase58());

    await token.mintTo(provider.connection, admin, underlyingMint, userTokenAccount, admin.publicKey, 1000);
    console.log("Minted 1000 tokens to user:", userTokenAccount.toBase58());

    await vaultProgram.methods.deposit(new BN(100))
      .accounts({
        vault,
        user: user.publicKey,
        userTokenAccount,
        vaultTokenAccount,
        sharesMint,
        userSharesAccount,
        tokenProgram: token.TOKEN_PROGRAM_ID
      })
      .signers([user])
      .rpc();

    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    console.log("Vault balance after deposit:", vaultAccount.totalDebt.toString());

    // Fetch the vault token account balance to verify the deposit
    let vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    assert.strictEqual(vaultTokenAccountInfo.amount.toString(), '100');

    // Fetch the user's token account balance to verify the deduction
    let userTokenAccountInfo = await token.getAccount(provider.connection, userTokenAccount);
    assert.strictEqual(userTokenAccountInfo.amount.toString(), '900');

    // check the user shares account balance
    let userSharesAccountInfo = await token.getAccount(provider.connection, userSharesAccount);
    assert.strictEqual(userSharesAccountInfo.amount.toString(), '100');
  });
  it("Allocates tokens to the strategy", async () => {
    const provider = anchor.AnchorProvider.env();

    await vaultProgram.methods.updateDebt(new BN(60))
      .accounts({
        vault,
        vaultTokenAccount,
        strategy,
        strategyTokenAccount,
        admin: admin.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        strategyProgram: strategyProgram.programId,
      })
      .signers([admin])
      .rpc();
  
    // Fetch the vault token account balance to verify the allocation
    let vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    assert.strictEqual(vaultTokenAccountInfo.amount.toString(), '40');
  
    // Fetch the strategy token account balance to verify the allocation
    let strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    assert.strictEqual(strategyTokenAccountInfo.amount.toString(), '60');
  
    // Fetch the strategy account to verify the state change
    let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.totalAssets.toString(), '60');

    // check strategy debt
    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.strategies[0].currentDebt.toString(), '60');
    assert.strictEqual(vaultAccount.totalDebt.toString(), '60');
    assert.strictEqual(vaultAccount.totalIdle.toString(), '40');
  });

  it("Deallocates tokens from the strategy", async () => {
    const provider = anchor.AnchorProvider.env();

    await vaultProgram.methods.updateDebt(new BN(30))
    .accounts({
      vault,
      vaultTokenAccount,
      strategy,
      strategyTokenAccount,
      admin: admin.publicKey,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      strategyProgram: strategyProgram.programId,
    })
    .signers([admin])
    .rpc();
  
    // Fetch the vault token account balance to verify the allocation
    let vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    assert.strictEqual(vaultTokenAccountInfo.amount.toString(), '70');
  
    // Fetch the strategy token account balance to verify the allocation
    let strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    assert.strictEqual(strategyTokenAccountInfo.amount.toString(), '30');
  
    // Fetch the strategy account to verify the state change
    let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.totalAssets.toString(), '30');

       // check strategy debt
    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.strategies[0].currentDebt.toString(), '30');
    assert.strictEqual(vaultAccount.totalDebt.toString(), '30');
    assert.strictEqual(vaultAccount.totalIdle.toString(), '70');
  });

  it("Withdraws tokens from the vault", async () => {
    const provider = anchor.AnchorProvider.env();

    let vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.totalIdle.toString(), '70');

    console.log("Vault balance before withdraw:", vaultAccount.totalIdle.toString());
    console.log("Vault debt before withdraw:", vaultAccount.totalDebt.toString());

    await vaultProgram.methods.withdraw(new BN(10), new BN(0))
      .accounts({
        vault,
        user: user.publicKey,
        userTokenAccount,
        vaultTokenAccount,
        sharesMint,
        userSharesAccount,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        strategyProgram: strategyProgram.programId,
      })
      .remainingAccounts([
        { pubkey: strategy, isWritable: true, isSigner: false },
        { pubkey: strategyTokenAccount, isWritable: true, isSigner: false },
      ])
      .signers([user])
      .rpc();

    vaultAccount = await vaultProgram.account.vault.fetch(vault);
    console.log("Vault balance after withdraw:", vaultAccount.totalIdle.toString());
    console.log("Vault debt after withdraw:", vaultAccount.totalDebt.toString());
    assert.strictEqual(vaultAccount.totalIdle.toString(), '60');

    let vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    assert.strictEqual(vaultTokenAccountInfo.amount.toString(), '60');

    // check the user shares account balance
    let userSharesAccountInfo = await token.getAccount(provider.connection, userSharesAccount);
    assert.strictEqual(userSharesAccountInfo.amount.toString(), '90');

    // check the user token account balance
    let userTokenAccountInfo = await token.getAccount(provider.connection, userTokenAccount);
    assert.strictEqual(userTokenAccountInfo.amount.toString(), '910');
  });

  it("transfer shares and withdraw", async () => {
    const provider = anchor.AnchorProvider.env();

    const newOwner = anchor.web3.Keypair.generate();
    const airdropSignature = await provider.connection.requestAirdrop(newOwner.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);

    const newOwnerSharesAccount = await token.createAccount(provider.connection, newOwner, sharesMint, newOwner.publicKey);
    const newOwnerTokenAccount = await token.createAccount(provider.connection, newOwner, underlyingMint, newOwner.publicKey);

    console.log("New owner public key:", newOwner.publicKey.toBase58());
    const shares = new BN(10);

    // send shares to new owner
    await token.transfer(provider.connection, user, userSharesAccount, newOwnerSharesAccount, user, 10);

    // check the user shares account balance
    let userSharesAccountInfo = await token.getAccount(provider.connection, userSharesAccount);
    assert.strictEqual(userSharesAccountInfo.amount.toString(), '80');

    // check the new owner shares account balance
    let newOwnerSharesAccountInfo = await token.getAccount(provider.connection, newOwnerSharesAccount);
    assert.strictEqual(newOwnerSharesAccountInfo.amount.toString(), '10');

    await vaultProgram.methods.withdraw(shares, new BN(0))
      .accounts({
        vault,
        user: newOwner.publicKey,
        userTokenAccount: newOwnerTokenAccount,
        vaultTokenAccount,
        sharesMint,
        userSharesAccount: newOwnerSharesAccount,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        strategyProgram: strategyProgram.programId,
      })
      .remainingAccounts([
        { pubkey: strategy, isWritable: true, isSigner: false },
        { pubkey: strategyTokenAccount, isWritable: true, isSigner: false },
      ])
      .signers([newOwner])
      .rpc();

    // check the new owner shares account balance
    newOwnerSharesAccountInfo = await token.getAccount(provider.connection, newOwnerSharesAccount);
    assert.strictEqual(newOwnerSharesAccountInfo.amount.toString(), '0');

    // check the user token account balance
    let userTokenAccountInfo = await token.getAccount(provider.connection, userTokenAccount);
    assert.strictEqual(userTokenAccountInfo.amount.toString(), '910');
  });

  it("set deposit limit", async () => {
    const newDepositLimit = new BN(2000);

    await vaultProgram.methods.setDepositLimit(newDepositLimit)
    .accounts({
      vault,
      admin: admin.publicKey,
    })
    .signers([admin])
    .rpc();

    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.depositLimit.toString(), newDepositLimit.toString());
  });
});
