import { Program, AnchorProvider, BN, setProvider, web3, workspace } from "@coral-xyz/anchor";
import { Strategy } from "../../target/types/strategy";
import { TokenizedVault } from "../../target/types/tokenized_vault";
import * as token from "@solana/spl-token";
import * as borsh from 'borsh';
import { assert } from 'chai';
import { TradeFintechConfig, TradeFintechConfigSchema } from "../utils/schemas";

const METADATA_SEED = "metadata";
const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

describe("tokenized_vault with trade-fi strategy", () => {
  // Configure the client to use the local cluster.
  setProvider(AnchorProvider.env());

  const vaultProgram = workspace.TokenizedVault as Program<TokenizedVault>;
  const strategyProgram = workspace.Strategy as Program<Strategy>;

  let vault: web3.PublicKey;
  let sharesMint: web3.PublicKey;
  let userTokenAccount: web3.PublicKey;
  let vaultTokenAccount: web3.PublicKey;
  let strategyTokenAccount: web3.PublicKey;
  let userSharesAccount: web3.PublicKey;
  let strategy: web3.PublicKey;
  let user: web3.Keypair;
  let admin: web3.Keypair;
  let underlyingMint: web3.PublicKey;
  let adminTokenAccount: web3.PublicKey;

  before(async () => {
    user = web3.Keypair.generate();
    admin = web3.Keypair.generate();

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

  xit("init role admin", async () => {
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

  xit("set vault admin and reporting admin", async () => {
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

  xit("Initializes the vault", async () => {
    const config = {
      name: "Polite Viking Token",
      symbol: "PVT",
      uri: "https://gist.githubusercontent.com/vito-kovalione/08b86d3c67440070a8061ae429572494/raw/833e3d5f5988c18dce2b206a74077b2277e13ab6/PVT.json",
      depositLimit: new BN(1000000000),
      minUserDeposit: new BN(0),
      performanceFee: new BN(1000),
      profitMaxUnlockTime: new BN(0),
    };

    const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        sharesMint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    await vaultProgram.methods.initVault(new BN(0), config)
      .accounts({
        metadata: metadataAddress,
        underlyingMint,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.ok(vaultAccount.underlyingTokenAcc.equals(vaultTokenAccount));
    assert.strictEqual(vaultAccount.depositLimit.toString(), '1000000000');
    console.log("Vault deposit limit: ", vaultAccount.depositLimit.toString());
    console.log("minUserDeposit: ", vaultAccount.minUserDeposit.toString());
  });

  xit("Initializes the strategy", async () => {
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

    const strategyType = { tradeFintech: {} };

    const config = new TradeFintechConfig({
      depositLimit: new BN(1000),
      // deposit ends in 1 minute, epoch time in seconds
      depositPeriodEnds: new BN(Date.now() / 1000 + 60),
      // lock period ends in 2 minute
      lockPeriodEnds: new BN(Date.now() / 1000 + 2 * 60),
      performanceFee: new BN(1),
      feeManager: admin.publicKey
    });

    const configBytes = Buffer.from(borsh.serialize(TradeFintechConfigSchema, config));
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

    const strategyAccount = await strategyProgram.account.tradeFintechStrategy.fetch(strategy);
    assert.ok(strategyAccount.depositLimit.eq(new BN(1000)));
  });

  xit("set performance fee", async () => {
    await strategyProgram.methods.setPerformanceFee(new BN(1000))
      .accounts({
        strategy,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const strategyAccount = await strategyProgram.account.tradeFintechStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.feeData.performanceFee.toString(), '1000');
  });

  xit("set fee manager", async () => {
    const feeRecipient = web3.Keypair.generate();
    const airdropSignature = await AnchorProvider.env().connection.requestAirdrop(feeRecipient.publicKey, 10e9);
    await AnchorProvider.env().connection.confirmTransaction(airdropSignature);

    await strategyProgram.methods.setFeeManager(feeRecipient.publicKey)
      .accounts({
        strategy,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const strategyAccount = await strategyProgram.account.tradeFintechStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.feeData.feeManager.toString(), feeRecipient.publicKey.toString());
  });

  xit("Adds a strategy to the vault", async () => {
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

  xit("Deposits tokens into the vault", async () => {
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

  xit("Allocates tokens to the strategy", async () => {
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
    let strategyAccount = await strategyProgram.account.tradeFintechStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.totalAssets.toString(), '90');

    // check strategy debt
    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.strategies[0].currentDebt.toString(), '90');
    assert.strictEqual(vaultAccount.totalDebt.toString(), '90');
    assert.strictEqual(vaultAccount.totalIdle.toString(), '10');
  });

  xit("Deallocates tokens from the strategy", async () => {
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
    let strategyAccount = await strategyProgram.account.tradeFintechStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.totalAssets.toString(), '80');

    // check strategy debt
    const vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.strategies[0].currentDebt.toString(), '80');
    assert.strictEqual(vaultAccount.totalDebt.toString(), '80');
    assert.strictEqual(vaultAccount.totalIdle.toString(), '20');
  });

  xit("Withdraws tokens from the vault", async () => {
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

  xit("deploy funds before deposit period ends", async () => {
    const provider = AnchorProvider.env();
    adminTokenAccount = await token.createAccount(provider.connection, admin, underlyingMint, admin.publicKey);

    try {
      await strategyProgram.methods.deployFunds(new BN(70))
        .accounts({
          strategy,
          signer: admin.publicKey,
        })
        .remainingAccounts([
          { pubkey: adminTokenAccount, isWritable: true, isSigner: false },
        ])
        .signers([admin])
        .rpc();
      assert.fail("This should have failed");
    }
    catch (e) {
      assert.strictEqual(e.message, 'AnchorError occurred. Error Code: DepositPeriodNotEnded. Error Number: 6000. Error Message: Deposit period has not ended.');
    }
  });

  xit("deploy funds", async () => {
    const provider = AnchorProvider.env();

    // wait 1 minute till the deposit period ends
    await new Promise(resolve => setTimeout(resolve, 60 * 1000));

    await strategyProgram.methods.deployFunds(new BN(70))
      .accounts({
        strategy,
        signer: admin.publicKey,
      })
      .remainingAccounts([
        { pubkey: adminTokenAccount, isWritable: true, isSigner: false },
      ])
      .signers([admin])
      .rpc();

    let strategyAccount = await strategyProgram.account.tradeFintechStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.totalInvested.toString(), '70');

    // check the strategy token account balance
    let strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    assert.strictEqual(strategyTokenAccountInfo.amount.toString(), '0');

    // check the admin token account balance
    let adminTokenAccountInfo = await token.getAccount(provider.connection, adminTokenAccount);
    assert.strictEqual(adminTokenAccountInfo.amount.toString(), '70');
  });

  xit("report profit before lock ends", async () => {
    try {
      await strategyProgram.methods.reportProfit(new BN(60))
        .accounts({
          strategy,
          signer: admin.publicKey,
        })
        .remainingAccounts([
          { pubkey: vaultTokenAccount, isWritable: true, isSigner: false },
        ])
        .signers([admin])
        .rpc();
      assert.fail("This should have failed");
    }
    catch (e) {
      assert.strictEqual(e.message, 'AnchorError occurred. Error Code: LockPeriodNotEnded. Error Number: 6001. Error Message: Lock period has not ended.');
    }
  });

  xit("report profit", async () => {
    const provider = AnchorProvider.env();

    const feeRecipient = web3.Keypair.generate();
    const airdropSignature = await provider.connection.requestAirdrop(feeRecipient.publicKey, 10e9);
    await provider.connection.confirmTransaction(airdropSignature);

    const feeRecipientSharesAccount = await token.createAccount(provider.connection, feeRecipient, sharesMint, feeRecipient.publicKey);

    // check total shares before report
    let vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.totalShares.toString(), '70');

    console.log("User token account:", adminTokenAccount.toBase58());

    await token.mintTo(provider.connection, admin, underlyingMint, adminTokenAccount, admin.publicKey, 1000);
    console.log("Minted 1000 tokens to user:", adminTokenAccount.toBase58());

    // wait 1 minute till the lock period ends
    await new Promise(resolve => setTimeout(resolve, 60 * 1000));

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

    console.log("Reported profit and updated vault.");

    await vaultProgram.methods.processReport()
      .accounts({
        vault,
        strategy,
        signer: admin.publicKey,
        feeSharesRecipient: feeRecipientSharesAccount,
      })
      .signers([admin])
      .rpc();

    console.log("Processed report.");

    vaultAccount = await vaultProgram.account.vault.fetch(vault);
    assert.strictEqual(vaultAccount.totalShares.toString(), '72');

    // check fee balance
    let strategyAccount = await strategyProgram.account.tradeFintechStrategy.fetch(strategy);
    assert.strictEqual(strategyAccount.feeData.feeBalance.toString(), '6');

    // check the strategy token account balance
    let strategyTokenAccountInfo = await token.getAccount(provider.connection, strategyTokenAccount);
    assert.strictEqual(strategyTokenAccountInfo.amount.toString(), '130');

    // check the vault token account balance
    let vaultTokenAccountInfo = await token.getAccount(provider.connection, vaultTokenAccount);
    assert.strictEqual(vaultTokenAccountInfo.amount.toString(), '0');
  });
});
