import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Strategy } from "../target/types/strategy";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import * as borsh from 'borsh';
import { assert, expect } from 'chai';
import { SimpleStrategy, SimpleStrategySchema } from "../utils/schemas";


describe("tokenized_vault", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const vaultProgram = anchor.workspace.TokenizedVault as Program<TokenizedVault>;
  const strategyProgram = anchor.workspace.StrategyProgram as Program<Strategy>;

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
  let rolesData: anchor.web3.PublicKey;

  before(async () => {
    user = anchor.web3.Keypair.generate();
    admin = anchor.web3.Keypair.generate();

    console.log("Admin public key:", admin.publicKey.toBase58());
    console.log("User public key:", user.publicKey.toBase58());
    console.log("Vault Program ID:", vaultProgram.programId.toBase58());
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

    rolesData = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("roles")],
      vaultProgram.programId,
    )[0];
    console.log("Roles data:", rolesData.toBase58());
  });

  it("init roles account", async () => {
    await vaultProgram.methods.initRoles()
      .accounts({
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // check protocol admin
    const rolesAccount = await vaultProgram.account.roles.fetch(rolesData);
    assert.strictEqual(rolesAccount.protocolAdmin.toString(), admin.publicKey.toString());
    console.log("Protocol admin:", rolesAccount.protocolAdmin.toString());
  });

  it("Initializes the vault", async () => {
    await vaultProgram.methods.initialize(new BN(1))
      .accounts({
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
      performanceFee: new BN(1),
      feeManager: admin.publicKey.toBuffer(),
    });
    const configBytes = Buffer.from(borsh.serialize(SimpleStrategySchema, config));
    console.log("strategy:", strategy);
    await strategyProgram.methods.initialize(strategyType, configBytes)
      .accounts({
        strategy,
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

  it("set performance fee", async () => {
    await strategyProgram.methods.setPerformanceFee(new BN(1000))
      .accounts({
        strategy,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.feeData.performanceFee.toString(), '1000');
  });

  it("set performance fee - unauthorized", async () => {
    const provider = anchor.AnchorProvider.env();

    const newUser = anchor.web3.Keypair.generate();
    const airdropSignature = await provider.connection.requestAirdrop(newUser.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);

    try {
      await strategyProgram.methods.setPerformanceFee(new BN(1))
        .accounts({
          strategy,
          signer: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();
      assert.fail("Expected error was not thrown");
    } catch (err) {
      assert.strictEqual(err.message, "AnchorError occurred. Error Code: AccessDenied. Error Number: 6011. Error Message: Signer has no access.");
    }
  });

  it("set fee manager", async () => {
    const feeRecipient = anchor.web3.Keypair.generate();
    const airdropSignature = await anchor.getProvider().connection.requestAirdrop(feeRecipient.publicKey, 10e9);
    await anchor.getProvider().connection.confirmTransaction(airdropSignature);

    await strategyProgram.methods.setFeeManager(feeRecipient.publicKey)
      .accounts({
        strategy,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.feeData.feeManager.toString(), feeRecipient.publicKey.toString());
  });

  it("set vault admin and reporting admin", async () => {
    const key = admin.publicKey;

    let vaultsAdmin = { vaultsAdmin: {} };
    await vaultProgram.methods.setRole(vaultsAdmin, key)
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    let reportingManager = { reportingManager: {} };
    await vaultProgram.methods.setRole(reportingManager, key)
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // check protocol admin and reporting manager
    const rolesAccount = await vaultProgram.account.roles.fetch(rolesData);
    assert.strictEqual(rolesAccount.vaultsAdmin.toString(), admin.publicKey.toString());
    assert.strictEqual(rolesAccount.reportingManager.toString(), admin.publicKey.toString());
  });

  it("Adds a strategy to the vault", async () => {
    await vaultProgram.methods.addStrategy(new BN(1000000000))
      .accounts({
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

    await vaultProgram.methods.updateDebt(new BN(90))
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
    assert.strictEqual(vaultTokenAccountInfo.amount.toString(), '10');

    // Fetch the strategy token account balance to verify the allocation
    let strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    assert.strictEqual(strategyTokenAccountInfo.amount.toString(), '90');

    // Fetch the strategy account to verify the state change
    let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.totalAssets.toString(), '90');

    // check strategy debt
    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.strategies[0].currentDebt.toString(), '90');
    assert.strictEqual(vaultAccount.totalDebt.toString(), '90');
    assert.strictEqual(vaultAccount.totalIdle.toString(), '10');
  });

  //TODO:
  it("Deallocates tokens from the strategy", async () => {
    const provider = anchor.AnchorProvider.env();

    await vaultProgram.methods.updateDebt(new BN(80))
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
    assert.strictEqual(vaultTokenAccountInfo.amount.toString(), '20');

    // Fetch the strategy token account balance to verify the allocation
    let strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    assert.strictEqual(strategyTokenAccountInfo.amount.toString(), '80');

    // Fetch the strategy account to verify the state change
    let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.totalAssets.toString(), '80');

    // check strategy debt
    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.strategies[0].currentDebt.toString(), '80');
    assert.strictEqual(vaultAccount.totalDebt.toString(), '80');
    assert.strictEqual(vaultAccount.totalIdle.toString(), '20');
  });


  it("Withdraws tokens from the vault", async () => {
    const provider = anchor.AnchorProvider.env();

    let vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.totalIdle.toString(), '20');

    console.log("Vault balance before withdraw:", vaultAccount.totalIdle.toString());
    console.log("Vault debt before withdraw:", vaultAccount.totalDebt.toString());

    const remainingAccountsMap = {
      accountsMap: [
        {
          strategyAcc: new BN(0),
          strategyTokenAccount: new BN(1),
          remainingAccountsToStrategies: [new BN(0)],
        }]
    };

    await vaultProgram.methods.withdraw(new BN(30), new BN(10000), remainingAccountsMap)
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
    assert.strictEqual(vaultAccount.totalIdle.toString(), '0');

    let vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    console.log("Vault token account balance after withdraw:", vaultTokenAccountInfo.amount.toString());
    assert.strictEqual(vaultTokenAccountInfo.amount.toString(), '0');

    // check the user shares account balance
    let userSharesAccountInfo = await token.getAccount(provider.connection, userSharesAccount);
    console.log("User shares account balance after withdraw:", userSharesAccountInfo.amount.toString());
    assert.strictEqual(userSharesAccountInfo.amount.toString(), '70');

    // check the user token account balance
    let userTokenAccountInfo = await token.getAccount(provider.connection, userTokenAccount);
    console.log("User token account balance after withdraw:", userTokenAccountInfo.amount.toString());
    assert.strictEqual(userTokenAccountInfo.amount.toString(), '930');
  });

  it("withdraw directly from strategy -> should revert", async () => {
    try {
      await strategyProgram.methods.withdraw(new BN(1))
        .accounts({
          strategy,
          vault: admin.publicKey,
          tokenAccount: strategyTokenAccount,
          vaultTokenAccount: userTokenAccount,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        })
        .signers([admin])
        .rpc();
      assert.fail("Expected error was not thrown");
    } catch (err) {
      assert.strictEqual(err.message, "unknown signer: " + admin.publicKey.toBase58());
    }
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
    console.log("User shares account balance:", userSharesAccountInfo.amount.toString());

    // check the new owner shares account balance
    let newOwnerSharesAccountInfo = await token.getAccount(provider.connection, newOwnerSharesAccount);
    console.log("New owner shares account balance:", newOwnerSharesAccountInfo.amount.toString());

    const remainingAccountsMap = {
      accountsMap: [
        {
          strategyAcc: new BN(0),
          strategyTokenAccount: new BN(1),
          remainingAccountsToStrategies: [new BN(0)],
        }]
    };

    await vaultProgram.methods.withdraw(shares, new BN(0), remainingAccountsMap)
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
    let userTokenAccountInfo = await token.getAccount(provider.connection, newOwnerTokenAccount);
    assert.strictEqual(userTokenAccountInfo.amount.toString(), '10');
  });

  it("report profit", async () => {
    const provider = anchor.AnchorProvider.env();

    const feeRecipient = anchor.web3.Keypair.generate();
    const airdropSignature = await provider.connection.requestAirdrop(feeRecipient.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);

    const feeRecipientSharesAccount = await token.createAccount(provider.connection, feeRecipient, sharesMint, feeRecipient.publicKey);
    const feeRecipientTokenAccount = await token.createAccount(provider.connection, feeRecipient, underlyingMint, feeRecipient.publicKey);

    // 60 tokens profit for the srategy
    await token.mintTo(provider.connection, admin, underlyingMint, strategyTokenAccount, admin.publicKey, 60);

    console.log("Minted 60 tokens to strategy:", strategyTokenAccount.toBase58());

    // check total shares before report
    let vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.totalShares.toString(), '60');

    await strategyProgram.methods.report()
      .accounts({
        strategy,
        tokenAccount: strategyTokenAccount,
        signer: admin.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: strategyTokenAccount, isWritable: true, isSigner: false },
      ])
      .signers([admin])
      .rpc();

    await vaultProgram.methods.processReport()
      .accounts({
        vault,
        strategy,
        admin: admin.publicKey,
        feeSharesRecipient: feeRecipientSharesAccount,
        sharesMint,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();

    vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.totalShares.toString(), '62');

    // check fee balance
    let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.feeData.feeBalance.toString(), '6');

    // check the strategy token account balance
    let strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    assert.strictEqual(strategyTokenAccountInfo.amount.toString(), '120');

    // check the vault token account balance
    let vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    assert.strictEqual(vaultTokenAccountInfo.amount.toString(), '0');

    // withdraw
    const remainingAccountsMap = {
      accountsMap: [
        {
          strategyAcc: new BN(0),
          strategyTokenAccount: new BN(1),
          remainingAccountsToStrategies: [new BN(0)],
        }]
    };

    await vaultProgram.methods.withdraw(new BN(10), new BN(0), remainingAccountsMap)
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

    // check the user shares account balance (burned 10 shares)
    let userSharesAccountInfo = await token.getAccount(provider.connection, userSharesAccount);
    assert.strictEqual(userSharesAccountInfo.amount.toString(), '50');

    // check the user token account balance (received 19 tokens)
    let userTokenAccountInfo = await token.getAccount(provider.connection, userTokenAccount);
    assert.strictEqual(userTokenAccountInfo.amount.toString(), '948');

    let feeRecipientSharesAccountInfo = await token.getAccount(provider.connection, feeRecipientSharesAccount);
    assert.strictEqual(feeRecipientSharesAccountInfo.amount.toString(), '2');

    // withdraw fee
    await vaultProgram.methods.withdraw(new BN(2), new BN(0), remainingAccountsMap)
      .accounts({
        vault,
        user: feeRecipient.publicKey,
        userTokenAccount: feeRecipientTokenAccount,
        vaultTokenAccount,
        sharesMint,
        userSharesAccount: feeRecipientSharesAccount,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        strategyProgram: strategyProgram.programId,
      })
      .remainingAccounts([
        { pubkey: strategy, isWritable: true, isSigner: false },
        { pubkey: strategyTokenAccount, isWritable: true, isSigner: false },
      ])
      .signers([feeRecipient])
      .rpc();

    // check the fee recipient shares account balance (burned 3 shares)
    feeRecipientSharesAccountInfo = await token.getAccount(provider.connection, feeRecipientSharesAccount);
    assert.strictEqual(feeRecipientSharesAccountInfo.amount.toString(), '0');

    // check the fee recipient token account balance (received 3 tokens)
    let feeRecipientTokenAccountInfo = await token.getAccount(provider.connection, feeRecipientTokenAccount);
    assert.strictEqual(feeRecipientTokenAccountInfo.amount.toString(), '3');
  });

  it("strategy report - unauthorized", async () => {
    const provider = anchor.AnchorProvider.env();

    const newUser = anchor.web3.Keypair.generate();
    const airdropSignature = await provider.connection.requestAirdrop(newUser.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);
    try {
      await strategyProgram.methods.report()
        .accounts({
          strategy,
          tokenAccount: strategyTokenAccount,
          signer: newUser.publicKey,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          { pubkey: strategyTokenAccount, isWritable: true, isSigner: false },
        ])
        .signers([newUser])
        .rpc();
      assert.fail("Expected error was not thrown");
    } catch (err) {
      assert.strictEqual(err.message, "AnchorError occurred. Error Code: AccessDenied. Error Number: 6011. Error Message: Signer has no access.");
    }
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

  it("set deposit limit - unauthorized", async () => {
    const provider = anchor.AnchorProvider.env();

    const newUser = anchor.web3.Keypair.generate();
    const airdropSignature = await provider.connection.requestAirdrop(newUser.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);

    try {
      await vaultProgram.methods.setDepositLimit(new BN(1))
        .accounts({
          vault,
          admin: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();
      assert.fail("Expected error was not thrown");
    } catch (err) {
      expect(err.message).to.contain("AnchorError caused by account: admin. Error Code: ConstraintAddress. Error Number: 2012. Error Message: An address constraint was violated.");
    }
  });

  it("remove strategy with debt", async () => {

    try {
      await vaultProgram.methods.removeStrategy(strategy, false)
        .accounts({
          vault,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();
      assert.fail("Expected error was not thrown");
    } catch (err) {
      expect(err.message).to.contain("Error Code: StrategyHasDebt");
    }
  });

  it("remove strategy with debt - force", async () => {
    await vaultProgram.methods.removeStrategy(strategy, true)
      .accounts({
        vault,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // shpuld be default value
    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.strategies[0].key.toString(), '11111111111111111111111111111111');
  });

  it("remove strategy - no debt", async () => {
    await vaultProgram.methods.addStrategy(new BN(1000000000))
    .accounts({
      vault,
      strategy,
      admin: admin.publicKey,
    })
    .signers([admin])
    .rpc();

    // get the vault strategies
    let vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.ok(vaultAccount.strategies[0].key.equals(strategy));

    await vaultProgram.methods.removeStrategy(strategy, false)
    .accounts({
      vault,
      admin: admin.publicKey,
    })
    .signers([admin])
    .rpc();

  // shpuld be default value
  vaultAccount = await vaultProgram.account.vault.fetch(vault);
  assert.strictEqual(vaultAccount.strategies[0].key.toString(), '11111111111111111111111111111111');
  });
});
