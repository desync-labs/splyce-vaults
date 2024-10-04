import { Program, AnchorProvider, BN, setProvider, web3, workspace } from "@coral-xyz/anchor";
import { Faucet } from "../../target/types/faucet";
import * as token from "@solana/spl-token";
import { assert, expect } from 'chai';

describe("tokenized_vault", () => {
  // Configure the client to use the local cluster.
  setProvider(AnchorProvider.env());

  let faucetProgram: Program<Faucet> = workspace.Faucet;

  let faucetData: web3.PublicKey;
  let faucetTokenAccount: web3.PublicKey;
  let admin: web3.Keypair;
  let user: web3.Keypair;
  let underlyingMint: web3.PublicKey;

  before(async () => {
    user = web3.Keypair.generate();
    admin = web3.Keypair.generate();

    console.log("Admin public key:", admin.publicKey.toBase58());

    // Airdrop SOL to the user
    const provider = AnchorProvider.env();
    const airdropSignature = await provider.connection.requestAirdrop(user.publicKey, 10e9);
    const airdropSignature2 = await provider.connection.requestAirdrop(admin.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);
    await provider.connection.confirmTransaction(airdropSignature2);


    underlyingMint = await token.createMint(provider.connection, admin, admin.publicKey, null, 9);
    console.log("Token mint public key:", underlyingMint.toBase58());

    faucetData = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("data")],
      faucetProgram.programId
    )[0];

    console.log("Faucet data public key:", faucetData.toBase58());

    faucetTokenAccount = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("underlying")],
      faucetProgram.programId
    )[0];

    console.log("Faucet token account public key:", faucetTokenAccount.toBase58());
  });


  it("init", async () => {
    await faucetProgram.methods.initialize()
      .accounts({
        underlyingMint,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const dataAccount = await faucetProgram.account.faucetData.fetch(faucetData);
    assert.strictEqual(dataAccount.owner.toString(), admin.publicKey.toString());
    assert.strictEqual(dataAccount.decimals, 9);
  });

  it("mint", async () => {
    const provider = AnchorProvider.env();

    // mint underlying tokens to the faucet token account
    await token.mintTo(provider.connection, admin, underlyingMint, faucetTokenAccount, admin, BigInt(1_000_000_000) * BigInt(1_000_000_000));

    console.log("Minted tokens to the faucet token account");
    // check the balance of the faucet token account
    const acc = await token.getAccount(provider.connection, faucetTokenAccount);
    console.log("Faucet token account balance:", acc.amount.toString());
  });

  it("send", async () => {
    const provider = AnchorProvider.env();

    const userTokenAccount = await token.createAccount(provider.connection, user, underlyingMint, user.publicKey);

    // send underlying tokens to the user
    await faucetProgram.methods.sendTokens()
      .accounts({
        recipient: userTokenAccount,
        signer: user.publicKey,
      })
      .signers([user])
      .rpc();

    console.log("Sent tokens to the user");

    // check the balance of the user
    const acc = await token.getAccount(provider.connection, userTokenAccount);
    console.log("User balance:", acc.amount.toString());
    assert.strictEqual(acc.amount.toString(), new BN(100).mul(new BN(10).pow(new BN(9))).toString());
  });

  it("set amount", async () => {
    await faucetProgram.methods.setDistributionAmount(new BN(230))
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const dataAccount = await faucetProgram.account.faucetData.fetch(faucetData);
    assert.strictEqual(dataAccount.amount.toString(), new BN(230).mul(new BN(10).pow(new BN(9))).toString());
  });

  it("set amount - unauthorized", async () => {
    try {
      await faucetProgram.methods.setDistributionAmount(new BN(230))
        .accounts({
          signer: user.publicKey,
        })
        .signers([user])
        .rpc();
        assert.fail("This should have failed");
    } catch (err) {
      console.log("Error occurred:", err);
      expect(err.message).to.contain("AnchorError caused by account: signer. Error Code: ConstraintAddress. Error Number: 2012. Error Message: An address constraint was violated");
    }
  });

});