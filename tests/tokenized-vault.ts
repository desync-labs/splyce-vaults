import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../target/types/tokenized_vault";
import { Strategy } from "../target/types/strategy";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as borsh from 'borsh';

describe("tokenized_vault", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
  const strategyProgram = anchor.workspace.Strategy as Program<Strategy>;
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
      [Buffer.from("vault"), underlyingMint.toBuffer()],
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
      vaultProgram.programId
    )[0];
    console.log("Vault token account:", vaultTokenAccount.toBase58());
  });

  it("Initializes the vault", async () => {
    await vaultProgram.methods.initialize()
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

    console.log("Vault public key:", vault.toBase58());

    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    console.log("Vault initialized with total balance:", vaultAccount.totalDebt.toString());
  });

  it("Initializes the strategy", async () => {
    strategy = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("strategy")],
      strategyProgram.programId
    )[0];

    strategyTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("underlying")],
      strategyProgram.programId
    )[0];


    await strategyProgram.methods.initialize(vault[0], new BN(1000))
      .accounts({
        strategy,
        tokenAccount: strategyTokenAccount,
        underlyingMint,
        admin: admin.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    console.log("Strategy public key:", strategy.toBase58());

    const strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    // console.log("Strategy initialized with total balance:", strategyAccount.depositLimit.toString());

  });

  it("Adds a strategy to the vault", async () => {
    await vaultProgram.methods.addStrategy()
      .accounts({
        vault,
        strategy,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // get the vault strategies
    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    console.log("Vault strategies after adding strategy:", vaultAccount.strategies[0].toString());

    // strategy data
    const strategyData = await strategyProgram.account.simpleStrategy.fetch(strategy);
    console.log("Strategy account data after adding strategy:", strategyData.depositLimit.toString());
   
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
    console.log("Vault token account balance after deposit:", vaultTokenAccountInfo.amount.toString());

    // Fetch the user's token account balance to verify the deduction
    let userTokenAccountInfo = await token.getAccount(provider.connection, userTokenAccount);
    console.log("User token account balance after deposit:", userTokenAccountInfo.amount.toString());

    // check the user shares account balance
    let userSharesAccountInfo = await token.getAccount(provider.connection, userSharesAccount);
    console.log("User shares account balance after deposit:", userSharesAccountInfo.amount.toString());
  });
  it("Allocates tokens to the strategy", async () => {
    const provider = anchor.AnchorProvider.env();

    let vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    console.log("Vault token account balance before allocation:", vaultTokenAccountInfo.amount.toString());
  
    // Fetch the strategy token account balance to verify the allocation
    let strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    console.log("Strategy token account balance before allocation:", strategyTokenAccountInfo.amount.toString());
  
    // Fetch the strategy account to verify the state change
    let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    console.log("Strategy total funds before allocation:", strategyAccount.totalFunds.toString());

    // const allocateAmount = new BN(5);
    await vaultProgram.methods.allocate(new BN(50))
      .accounts({
        vault,
        vaultTokenAccount,
        strategyProgram: strategyProgram.programId,
        strategy,
        strategyTokenAccount,
        admin: admin.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  
    // Fetch the vault token account balance to verify the allocation
    vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    console.log("Vault token account balance after allocation:", vaultTokenAccountInfo.amount.toString());
  
    // Fetch the strategy token account balance to verify the allocation
    strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    console.log("Strategy token account balance after allocation:", strategyTokenAccountInfo.amount.toString());
  
    // Fetch the strategy account to verify the state change
    strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    console.log("Strategy total funds after allocation:", strategyAccount.totalFunds.toString());
  });

  it("Deallocates tokens from the strategy", async () => {
    const provider = anchor.AnchorProvider.env();

    let vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    console.log("Vault token account balance before allocation:", vaultTokenAccountInfo.amount.toString());
  
    // Fetch the strategy token account balance to verify the allocation
    let strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    console.log("Strategy token account balance before allocation:", strategyTokenAccountInfo.amount.toString());
  
    // Fetch the strategy account to verify the state change
    let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    console.log("Strategy total funds before allocation:", strategyAccount.totalFunds.toString());

    // const allocateAmount = new BN(5);
    await vaultProgram.methods.deallocate(new BN(30))
      .accounts({
        vault,
        vaultTokenAccount,
        strategyProgram: strategyProgram.programId,
        strategy,
        strategyTokenAccount,
        admin: admin.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  
    // Fetch the vault token account balance to verify the allocation
    vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    console.log("Vault token account balance after allocation:", vaultTokenAccountInfo.amount.toString());
  
    // Fetch the strategy token account balance to verify the allocation
    strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    console.log("Strategy token account balance after allocation:", strategyTokenAccountInfo.amount.toString());
  
    // Fetch the strategy account to verify the state change
    strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    console.log("Strategy total funds after allocation:", strategyAccount.totalFunds.toString());
  });

  xit("Withdraws tokens from the vault", async () => {
    const provider = anchor.AnchorProvider.env();

    const shares = new BN(10);

    await vaultProgram.methods.withdraw(shares)
      .accounts({
        vault,
        user: user.publicKey,
        userTokenAccount,
        vaultTokenAccount,
        sharesMint,
        userSharesAccount,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    console.log("Vault balance after withdrawal:", vaultAccount.totalDebt.toString());

    // check the user shares account balance
    let userSharesAccountInfo = await token.getAccount(provider.connection, userSharesAccount);
    console.log("User shares account balance after withdrawal:", userSharesAccountInfo.amount.toString());

    // check the user token account balance
    let userTokenAccountInfo = await token.getAccount(provider.connection, userTokenAccount);
    console.log("User token account balance after withdrawal:", userTokenAccountInfo.amount.toString());
  });

  xit("transfer shares and withdraw", async () => {
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
    console.log("User shares account balance after transfer:", userSharesAccountInfo.amount.toString());

    // check the new owner shares account balance
    let newOwnerSharesAccountInfo = await token.getAccount(provider.connection, newOwnerSharesAccount);
    console.log("New owner shares account balance after transfer:", newOwnerSharesAccountInfo.amount.toString());

    await vaultProgram.methods.withdraw(shares)
      .accounts({
        vault,
        user: newOwner.publicKey,
        userTokenAccount: newOwnerTokenAccount,
        vaultTokenAccount,
        sharesMint,
        userSharesAccount: newOwnerSharesAccount,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .signers([newOwner])
      .rpc();

    // check the new owner shares account balance
    newOwnerSharesAccountInfo = await token.getAccount(provider.connection, newOwnerSharesAccount);
    console.log("New owner shares account balance after withdrawal:", newOwnerSharesAccountInfo.amount.toString());

    // check the user token account balance
    let userTokenAccountInfo = await token.getAccount(provider.connection, userTokenAccount);
    console.log("User token account balance after withdrawal:", userTokenAccountInfo.amount.toString());
  });
});