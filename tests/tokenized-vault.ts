import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenizedVault } from "../target/types/tokenized_vault";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";

describe("tokenized_vault", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
  const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  let vault: anchor.web3.PublicKey;
  let sharesMint: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  let vaultTokenAccount: anchor.web3.PublicKey;
  let userSharesAccount: anchor.web3.PublicKey;
  let user: anchor.web3.Keypair;
  let admin: anchor.web3.Keypair;
  let underlyingMint: anchor.web3.PublicKey;

  before(async () => {
    user = anchor.web3.Keypair.generate();
    admin = anchor.web3.Keypair.generate();

    console.log("Admin public key:", admin.publicKey.toBase58());
    console.log("User public key:", user.publicKey.toBase58());
    console.log("Program ID:", program.programId.toBase58());

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
      program.programId
    )[0];
    console.log("Vault PDA:", vault.toBase58());

    sharesMint = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vault.toBuffer()], 
      program.programId
    )[0];
    console.log("Shares sharesMintDerived public key:", sharesMint.toBase58());
    console.log("program.programId:", program.programId.toBase58());

    vaultTokenAccount = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), vault.toBuffer()], 
      program.programId
    )[0];
    console.log("Vault token account:", vaultTokenAccount.toBase58());
  });

  it("Initializes the vault", async () => {
    await program.methods.initialize()
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

    const vaultAccount = await program.account.vault.fetch(vault);
    console.log("Vault initialized with total balance:", vaultAccount.totalDebt.toString());
  });

  it("Deposits tokens into the vault", async () => {
    const provider = anchor.AnchorProvider.env();

    userTokenAccount = await token.createAccount(provider.connection, user, underlyingMint, user.publicKey);
    console.log("User token account:", userTokenAccount.toBase58());

    userSharesAccount = await token.createAccount(provider.connection, user, sharesMint, user.publicKey);
    console.log("User shares account:", userSharesAccount.toBase58());

    await token.mintTo(provider.connection, admin, underlyingMint, userTokenAccount, admin.publicKey, 1000);
    console.log("Minted 1000 tokens to user:", userTokenAccount.toBase58());

    await program.methods.deposit(new BN(100))
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

    const vaultAccount = await program.account.vault.fetch(vault);
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

  it("Withdraws tokens from the vault", async () => {
    const provider = anchor.AnchorProvider.env();

    const shares = new BN(50);

    await program.methods.withdraw(shares)
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

    const vaultAccount = await program.account.vault.fetch(vault);
    console.log("Vault balance after withdrawal:", vaultAccount.totalDebt.toString());

    // check the user shares account balance
    let userSharesAccountInfo = await token.getAccount(provider.connection, userSharesAccount);
    console.log("User shares account balance after withdrawal:", userSharesAccountInfo.amount.toString());

    // check the user token account balance
    let userTokenAccountInfo = await token.getAccount(provider.connection, userTokenAccount);
    console.log("User token account balance after withdrawal:", userTokenAccountInfo.amount.toString());
  });

  it("transfer shares and withdraw", async () => {
    const provider = anchor.AnchorProvider.env();

    const newOwner = anchor.web3.Keypair.generate();
    const airdropSignature = await provider.connection.requestAirdrop(newOwner.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);

    const newOwnerSharesAccount = await token.createAccount(provider.connection, newOwner, sharesMint, newOwner.publicKey);
    const newOwnerTokenAccount = await token.createAccount(provider.connection, newOwner, underlyingMint, newOwner.publicKey);

    console.log("New owner public key:", newOwner.publicKey.toBase58());
    const shares = new BN(50);

    // send shares to new owner
    await token.transfer(provider.connection, user, userSharesAccount, newOwnerSharesAccount, user, 50);

    // check the user shares account balance
    let userSharesAccountInfo = await token.getAccount(provider.connection, userSharesAccount);
    console.log("User shares account balance after transfer:", userSharesAccountInfo.amount.toString());

    // check the new owner shares account balance
    let newOwnerSharesAccountInfo = await token.getAccount(provider.connection, newOwnerSharesAccount);
    console.log("New owner shares account balance after transfer:", newOwnerSharesAccountInfo.amount.toString());

    await program.methods.withdraw(shares)
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