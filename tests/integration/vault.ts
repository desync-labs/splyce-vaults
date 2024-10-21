import { Program, AnchorProvider, BN, setProvider, web3, workspace } from "@coral-xyz/anchor";
import { StrategyProgram } from "../../target/types/strategy_program";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import * as token from "@solana/spl-token";
import * as borsh from 'borsh';
import { assert, expect } from 'chai';
import { SimpleStrategyConfig, SimpleStrategyConfigSchema } from "../utils/schemas";

const METADATA_SEED = "metadata";
const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

describe("tokenized_vault", () => {
  // Configure the client to use the local cluster.
  setProvider(AnchorProvider.env());

  const vaultProgram = workspace.TokenizedVault as Program<TokenizedVault>;
  const strategyProgram = workspace.StrategyProgram as Program<StrategyProgram>;

  let user: web3.Keypair;
  let admin: web3.Keypair;
  let feeRecipient: web3.Keypair;
  let strategyFeeManager: web3.Keypair;

  let vault: web3.PublicKey;
  let sharesMint: web3.PublicKey;
  let userTokenAccount: web3.PublicKey;
  let vaultTokenAccount: web3.PublicKey;
  let strategyTokenAccount: web3.PublicKey;
  let userSharesAccount: web3.PublicKey;
  let strategy: web3.PublicKey;
  let underlyingMint: web3.PublicKey;
  let feeRecipientSharesAccount: web3.PublicKey;
  let feeRecipientTokenAccount: web3.PublicKey;
  let adminTokenAccount: web3.PublicKey;

  before(async () => {
    user = web3.Keypair.generate();
    admin = web3.Keypair.generate();
    feeRecipient = web3.Keypair.generate();
    strategyFeeManager = web3.Keypair.generate();

    console.log("Admin public key:", admin.publicKey.toBase58());
    console.log("User public key:", user.publicKey.toBase58());
    console.log("Vault Program ID:", vaultProgram.programId.toBase58());
    console.log("Strategy Program ID:", strategyProgram.programId.toBase58());

    // Airdrop SOL to the user
    const provider = AnchorProvider.env();
    const airdropSignature = await provider.connection.requestAirdrop(user.publicKey, 10e9);
    const airdropSignature2 = await provider.connection.requestAirdrop(admin.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);
    await provider.connection.confirmTransaction(airdropSignature2);

    console.log("Airdropped 1 SOL to user:", user.publicKey.toBase58());

    underlyingMint = await token.createMint(provider.connection, admin, admin.publicKey, null, 9);
    console.log("Token mint public key:", underlyingMint.toBase58());

    vault = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(0)]).buffer))
      ],
      vaultProgram.programId
    )[0];
    console.log("Vault PDA:", vault.toBase58());

    sharesMint = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vault.toBuffer()],
      vaultProgram.programId
    )[0];
    console.log("Shares sharesMintDerived public key:", sharesMint.toBase58());

    vaultTokenAccount = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), vault.toBuffer()],
      vaultProgram.programId,
    )[0];
    console.log("Vault token account:", vaultTokenAccount.toBase58());
  });

  it("init role admin", async () => {
    await vaultProgram.methods.initRoleAdmin()
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();


    // check protocol admin
    const rolesAdmin = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_admin_role")],
      vaultProgram.programId,
    )[0];
    const rolesAccount = await vaultProgram.account.rolesAdmin.fetch(rolesAdmin);
    assert.strictEqual(rolesAccount.account.toString(), admin.publicKey.toString());
    console.log("Protocol admin:", rolesAccount.account.toString());
  });

  it("set vault admin and reporting admin", async () => {
    let vaultsAdmin = { vaultsAdmin: {} };
    await vaultProgram.methods.setRole(vaultsAdmin, admin.publicKey)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    let reportingManager = { reportingManager: {} };
    await vaultProgram.methods.setRole(reportingManager, admin.publicKey)
      .accounts({
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const accountRoles = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("roles"), admin.publicKey.toBuffer()],
      vaultProgram.programId,
    )[0];
    const rolesAccount = await vaultProgram.account.accountRoles.fetch(accountRoles);

    assert.isTrue(rolesAccount.isVaultsAdmin);
    assert.isTrue(rolesAccount.isReportingManager);
  });

  it("Initializes the vault", async () => {
    const vaultConfig = {
      depositLimit: new BN(1000000000),
      minUserDeposit: new BN(0),
      performanceFee: new BN(1000),
      profitMaxUnlockTime: new BN(0),
    };

    const sharesConfig = {
      name: "Polite Viking Token",
      symbol: "PVT",
      uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
    };

    const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        sharesMint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const config = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      vaultProgram.programId,
    )[0];

    await vaultProgram.methods.initialize()
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    let configAccount = await vaultProgram.account.config.fetch(config);
    assert.strictEqual(configAccount.nextVaultIndex.toString(), '0');

    await vaultProgram.methods.initVault(vaultConfig)
      .accounts({
        underlyingMint,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    configAccount = await vaultProgram.account.config.fetch(config);
    assert.strictEqual(configAccount.nextVaultIndex.toString(), '1');

    console.log("vault inited");
    let vaultAccount = await vaultProgram.account.vault.fetch(vault);
    // assert.ok(vaultAccount.underlyingTokenAcc.equals(vaultTokenAccount));
    assert.strictEqual(vaultAccount.depositLimit.toString(), '1000000000');
    console.log("Vault deposit limit: ", vaultAccount.depositLimit.toString());
    console.log("minUserDeposit: ", vaultAccount.minUserDeposit.toString());

    await vaultProgram.methods.initVaultShares(new BN(0), sharesConfig)
      .accounts({
        metadata: metadataAddress,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("shares inited");

    vaultAccount = await vaultProgram.account.vault.fetch(vault);
    // assert.ok(vaultAccount.underlyingTokenAcc.equals(vaultTokenAccount));
    // assert.strictEqual(vaultAccount.depositLimit.toString(), '1000000000');
    console.log("sharesBump: ", vaultAccount.sharesBump.toString());
    // console.log("minUserDeposit: ", vaultAccount.minUserDeposit.toString());


  });

  it("Initializes the strategy", async () => {
    strategy = web3.PublicKey.findProgramAddressSync(
      [
        vault.toBuffer(),
        Buffer.from(new Uint8Array([0]))
      ],
      strategyProgram.programId
    )[0];

    strategyTokenAccount = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("underlying"), strategy.toBuffer()],
      strategyProgram.programId,
    )[0];

    const strategyType = { simple: {} };

    const config = new SimpleStrategyConfig({
      depositLimit: new BN(1000),
      performanceFee: new BN(1),
      feeManager: admin.publicKey
    });

    console.log("config:", JSON.stringify(config));
    const configBytes = Buffer.from(borsh.serialize(SimpleStrategyConfigSchema, config));
    console.log("strategy:", strategy);
    await strategyProgram.methods.initStrategy(0, strategyType, configBytes)
      .accounts({
        underlyingMint,
        vault,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Strategy public key:", strategy.toBase58());

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
    const provider = AnchorProvider.env();

    const newUser = web3.Keypair.generate();
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
    const airdropSignature = await AnchorProvider.env().connection.requestAirdrop(feeRecipient.publicKey, 10e9);
    await AnchorProvider.env().connection.confirmTransaction(airdropSignature);

    await strategyProgram.methods.setFeeManager(strategyFeeManager.publicKey)
      .accounts({
        strategy,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.feeData.feeManager.toString(), strategyFeeManager.publicKey.toString());
  });

  it("Adds a strategy to the vault", async () => {
    await vaultProgram.methods.addStrategy(new BN(1000000000))
      .accounts({
        vault,
        strategy,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // get the vault strategies
    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.ok(vaultAccount.strategies[0].key.equals(strategy));
  });

  it("Deposits tokens into the vault", async () => {
    const provider = AnchorProvider.env();

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
        userSharesAccount,
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
    const provider = AnchorProvider.env();

    console.log("strategyTokenAccount:", strategyTokenAccount.toBase58());
    console.log("strategy:", strategy.toBase58());

    await vaultProgram.methods.updateDebt(new BN(90))
      .accounts({
        vault,
        strategy,
        strategyTokenAccount,
        signer: admin.publicKey,
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

  it("Deallocates tokens from the strategy", async () => {
    const provider = AnchorProvider.env();

    await vaultProgram.methods.updateDebt(new BN(80))
      .accounts({
        vault,
        strategy,
        strategyTokenAccount,
        signer: admin.publicKey,
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
    const provider = AnchorProvider.env();

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

    await vaultProgram.methods.redeem(new BN(30), new BN(10000), remainingAccountsMap)
      .accounts({
        vault,
        user: user.publicKey,
        userTokenAccount,
        userSharesAccount,
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
          signer: admin.publicKey,
          vaultTokenAccount: userTokenAccount,
        })
        .signers([admin])
        .rpc();
      assert.fail("Expected error was not thrown");
    } catch (err) {
      assert.strictEqual(err.message, "AnchorError occurred. Error Code: AccessDenied. Error Number: 6011. Error Message: Signer has no access.");
    }
  });

  it("transfer shares and withdraw", async () => {
    const provider = AnchorProvider.env();

    const newOwner = web3.Keypair.generate();
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

    await vaultProgram.methods.redeem(shares, new BN(0), remainingAccountsMap)
      .accounts({
        vault,
        user: newOwner.publicKey,
        userTokenAccount: newOwnerTokenAccount,
        userSharesAccount: newOwnerSharesAccount,
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
    const provider = AnchorProvider.env();

    const feeRecipient = web3.Keypair.generate();
    const airdropSignature = await provider.connection.requestAirdrop(feeRecipient.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);

    feeRecipientSharesAccount = await token.createAccount(provider.connection, feeRecipient, sharesMint, feeRecipient.publicKey);
    feeRecipientTokenAccount = await token.createAccount(provider.connection, feeRecipient, underlyingMint, feeRecipient.publicKey);
    adminTokenAccount = await token.createAccount(provider.connection, admin, underlyingMint, admin.publicKey);

    // 60 tokens profit for the srategy
    await token.mintTo(provider.connection, admin, underlyingMint, adminTokenAccount, admin.publicKey, 60);

    // check total shares before report
    let vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.totalShares.toString(), '60');
    await strategyProgram.methods.reportProfit(new BN(60))
      .accounts({
        strategy,
        signer: admin.publicKey,
      })
      .remainingAccounts([
        { pubkey: adminTokenAccount, isWritable: true, isSigner: false },
      ])
      .signers([admin])
      .rpc();

    await vaultProgram.methods.processReport()
      .accounts({
        vault,
        strategy,
        signer: admin.publicKey,
        feeSharesRecipient: feeRecipientSharesAccount,
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

    await vaultProgram.methods.redeem(new BN(10), new BN(0), remainingAccountsMap)
      .accounts({
        vault,
        user: user.publicKey,
        userTokenAccount,
        userSharesAccount,
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
    await vaultProgram.methods.redeem(new BN(2), new BN(0), remainingAccountsMap)
      .accounts({
        vault,
        user: feeRecipient.publicKey,
        userTokenAccount: feeRecipientTokenAccount,
        userSharesAccount: feeRecipientSharesAccount,
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
    const provider = AnchorProvider.env();

    const newUser = web3.Keypair.generate();
    const airdropSignature = await provider.connection.requestAirdrop(newUser.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);
    try {
      await strategyProgram.methods.report()
        .accounts({
          strategy,
          signer: newUser.publicKey,
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
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.depositLimit.toString(), newDepositLimit.toString());
  });

  it("set deposit limit - unauthorized", async () => {
    const provider = AnchorProvider.env();

    const newUser = web3.Keypair.generate();
    const airdropSignature = await provider.connection.requestAirdrop(newUser.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);

    try {
      await vaultProgram.methods.setDepositLimit(new BN(1))
        .accounts({
          vault,
          signer: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();
      assert.fail("Expected error was not thrown");
    } catch (err) {
      expect(err.message).to.contain("AnchorError caused by account: roles. Error Code: AccountNotInitialized");
    }
  });

  it("withdraw strategy fees", async () => {
    const provider = AnchorProvider.env();

    await token.mintTo(provider.connection, admin, underlyingMint, adminTokenAccount, admin.publicKey, 100);

    let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    let totalFees = strategyAccount.feeData.feeBalance;

    console.log("Total fees:", totalFees.toString());

    await strategyProgram.methods.withdrawFee(totalFees)
      .accounts({
        strategy,
        recipient: adminTokenAccount,
        signer: strategyFeeManager.publicKey,
      })
      .remainingAccounts([
        { pubkey: adminTokenAccount, isWritable: true, isSigner: false },
      ])
      .signers([strategyFeeManager])
      .rpc();

    strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.feeData.feeBalance.toString(), '0');

    const adminTokenAccountInfo = await token.getAccount(provider.connection, adminTokenAccount);
    assert.strictEqual(adminTokenAccountInfo.amount.toString(), '106');
  });

  it("report loss", async () => {
    const provider = AnchorProvider.env();

    const airdropSignature = await provider.connection.requestAirdrop(feeRecipient.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);

    console.log("Minted 1000 tokens to user:", adminTokenAccount.toBase58());

    await vaultProgram.methods.deposit(new BN(100))
      .accounts({
        vault,
        user: user.publicKey,
        userTokenAccount,
        userSharesAccount,
      })
      .signers([user])
      .rpc();

    let strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);

    await vaultProgram.methods.updateDebt(new BN(100))
      .accounts({
        vault,
        strategy,
        strategyTokenAccount,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // Fetch the strategy token account balance to verify the allocation
    strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    assert.strictEqual(strategyTokenAccountInfo.amount.toString(), new BN(100).toString());

    await strategyProgram.methods.reportLoss(new BN(10))
      .accounts({
        strategy,
        signer: admin.publicKey,
      })
      .remainingAccounts([
        { pubkey: adminTokenAccount, isWritable: true, isSigner: false },
      ])
      .signers([admin])
      .rpc();

    await vaultProgram.methods.processReport()
      .accounts({
        vault,
        strategy,
        signer: admin.publicKey,
        feeSharesRecipient: feeRecipientSharesAccount,
      })
      .signers([admin])
      .rpc();

    // check the strategy token account balance
    strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    assert.strictEqual(strategyTokenAccountInfo.amount.toString(), '90');


    // check the strategy account balance
    let strategyAccount = await strategyProgram.account.simpleStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.totalAssets.toString(), '90');
  });


  it("remove strategy with debt", async () => {

    try {
      await vaultProgram.methods.removeStrategy(strategy, false)
        .accounts({
          vault,
          signer: admin.publicKey,
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
        signer: admin.publicKey,
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
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // get the vault strategies
    let vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.ok(vaultAccount.strategies[0].key.equals(strategy));

    await vaultProgram.methods.removeStrategy(strategy, false)
      .accounts({
        vault,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // shpuld be default value
    vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.strategies[0].key.toString(), '11111111111111111111111111111111');
  });

  it("shutdown vault", async () => {
    await vaultProgram.methods.shutdownVault()
      .accounts({
        vault,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.isTrue(vaultAccount.isShutdown);
  });

  it("close vault", async () => {
    // get admin sol balance
    const provider = AnchorProvider.env();
    const adminSolBalance = await provider.connection.getBalance(admin.publicKey);
    console.log("Admin SOL balance:", adminSolBalance);

    await vaultProgram.methods.closeVault()
      .accounts({
        vault,
        signer: admin.publicKey,
        recipient: admin.publicKey,
      })
      .signers([admin])
      .rpc();

      // get admin sol balance
    const adminSolBalanceAfter = await provider.connection.getBalance(admin.publicKey);
    console.log("Admin SOL balance after:", adminSolBalanceAfter);

    // const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    // assert.isTrue(vaultAccount.isClosed);
  });
});
