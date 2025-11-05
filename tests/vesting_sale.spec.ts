import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("vesting_sale", () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vectaiproj as Program;
  const authority = provider.wallet as anchor.Wallet;
  const payer = authority.payer;

  // Test accounts
  let vectMint: PublicKey;
  let usdcMint: PublicKey;
  let saleState: PublicKey;
  let vectVault: PublicKey;
  let usdcTreasury: PublicKey;
  let buyer: Keypair;
  let buyerUsdcAccount: PublicKey;
  let vestingAccount: PublicKey;
  let buyer2: Keypair;
  let buyer2UsdcAccount: PublicKey;
  let vesting2Account: PublicKey;

  // Constants
  const CLIFF_DURATION = 90 * 24 * 60 * 60; // 3 months
  const VESTING_DURATION = 365 * 24 * 60 * 60; // 12 months
  const USDC_PRICE_PER_VECT = 50_000; // 0.05 USDC (6 decimals)
  const VECT_DECIMALS = 9;
  const USDC_DECIMALS = 6;
  const MIN_PURCHASE_USDC = 10_000_000; // 10 USDC

  before(async () => {
    console.log("Setting up test environment...");

    // Create VECT mint
    vectMint = await createMint(
      provider.connection,
      payer,
      authority.publicKey,
      null,
      VECT_DECIMALS
    );
    console.log("VECT Mint:", vectMint.toString());

    // Create USDC mint
    usdcMint = await createMint(
      provider.connection,
      payer,
      authority.publicKey,
      null,
      USDC_DECIMALS
    );
    console.log("USDC Mint:", usdcMint.toString());

    // Create buyers
    buyer = Keypair.generate();
    buyer2 = Keypair.generate();
    console.log("Buyer:", buyer.publicKey.toString());
    console.log("Buyer 2:", buyer2.publicKey.toString());

    // Airdrop SOL to buyers
    for (const b of [buyer, buyer2]) {
      const airdropSig = await provider.connection.requestAirdrop(
        b.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      );
      const latestBlockhash = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        signature: airdropSig,
        ...latestBlockhash,
      });
    }

    // Create buyers' USDC accounts and mint some USDC
    buyerUsdcAccount = await createAccount(
      provider.connection,
      payer,
      usdcMint,
      buyer.publicKey
    );
    await mintTo(
      provider.connection,
      payer,
      usdcMint,
      buyerUsdcAccount,
      authority.publicKey,
      1000 * 10 ** USDC_DECIMALS // 1000 USDC
    );

    buyer2UsdcAccount = await createAccount(
      provider.connection,
      payer,
      usdcMint,
      buyer2.publicKey
    );
    await mintTo(
      provider.connection,
      payer,
      usdcMint,
      buyer2UsdcAccount,
      authority.publicKey,
      1000 * 10 ** USDC_DECIMALS // 1000 USDC
    );

    console.log("Buyer USDC Account:", buyerUsdcAccount.toString());
    console.log("Buyer 2 USDC Account:", buyer2UsdcAccount.toString());

    // Derive PDAs
    [saleState] = PublicKey.findProgramAddressSync(
      [Buffer.from("sale"), authority.publicKey.toBuffer()],
      program.programId
    );

    [vectVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vect_vault"), saleState.toBuffer()],
      program.programId
    );

    [usdcTreasury] = PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_treasury"), saleState.toBuffer()],
      program.programId
    );

    [vestingAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vesting"),
        saleState.toBuffer(),
        buyer.publicKey.toBuffer(),
      ],
      program.programId
    );

    [vesting2Account] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vesting"),
        saleState.toBuffer(),
        buyer2.publicKey.toBuffer(),
      ],
      program.programId
    );

    console.log("Sale State:", saleState.toString());
    console.log("VECT Vault:", vectVault.toString());
    console.log("USDC Treasury:", usdcTreasury.toString());
  });

  it("Initialize sale", async () => {
    const tx = await program.methods
      .initializeSale(
        new anchor.BN(CLIFF_DURATION),
        new anchor.BN(VESTING_DURATION),
        new anchor.BN(USDC_PRICE_PER_VECT)
      )
      .accounts({
        saleState,
        authority: authority.publicKey,
        vectMint,
        usdcMint,
        vectVault,
        usdcTreasury,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize sale tx:", tx);

    // Verify sale state
    const saleStateAccount = await program.account.saleState.fetch(saleState);
    assert.equal(
      saleStateAccount.authority.toString(),
      authority.publicKey.toString()
    );
    assert.equal(saleStateAccount.vectMint.toString(), vectMint.toString());
    assert.equal(saleStateAccount.usdcMint.toString(), usdcMint.toString());
    assert.equal(
      saleStateAccount.cliffDuration.toNumber(),
      CLIFF_DURATION
    );
    assert.equal(
      saleStateAccount.vestingDuration.toNumber(),
      VESTING_DURATION
    );
    assert.equal(
      saleStateAccount.usdcPricePerVect.toNumber(),
      USDC_PRICE_PER_VECT
    );
    assert.equal(saleStateAccount.isPaused, false);
    assert.equal(saleStateAccount.isEnded, false);
    console.log("✅ Sale initialized successfully");
  });

  it("Fund vault with VECT tokens", async () => {
    // Create authority's VECT account
    const authorityVectAccount = await createAccount(
      provider.connection,
      payer,
      vectMint,
      authority.publicKey
    );

    // Mint VECT tokens to authority
    const fundAmount = 1_000_000 * 10 ** VECT_DECIMALS; // 1M VECT
    await mintTo(
      provider.connection,
      payer,
      vectMint,
      authorityVectAccount,
      authority.publicKey,
      fundAmount
    );

    // Fund the vault
    const tx = await program.methods
      .adminFundVault(new anchor.BN(fundAmount))
      .accounts({
        saleState,
        authority: authority.publicKey,
        adminVectAccount: authorityVectAccount,
        vectVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Fund vault tx:", tx);

    // Verify vault balance
    const vaultAccount = await getAccount(provider.connection, vectVault);
    assert.equal(vaultAccount.amount.toString(), fundAmount.toString());
    console.log("✅ Vault funded with", fundAmount, "VECT tokens");
  });

  it("Cannot buy with less than minimum (10 USDC)", async () => {
    const usdcAmount = 5 * 10 ** USDC_DECIMALS; // 5 USDC (below minimum)

    try {
      await program.methods
        .buyWithUsdc(new anchor.BN(usdcAmount))
        .accounts({
          saleState,
          vesting: vestingAccount,
          buyer: buyer.publicKey,
          buyerUsdcAccount,
          usdcTreasury,
          vectVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      assert.fail("Should have failed - below minimum purchase");
    } catch (error) {
      assert.include(error.toString(), "BelowMinimumPurchase");
      console.log("✅ Correctly prevented purchase below minimum");
    }
  });

  it("Buy VECT with USDC", async () => {
    const usdcAmount = 10 * 10 ** USDC_DECIMALS; // 10 USDC
    // Expected: (10 USDC * 10^9) / 50_000 = 200 VECT
    const expectedVectAmount = 200_000_000_000; // 200 VECT with 9 decimals

    const tx = await program.methods
      .buyWithUsdc(new anchor.BN(usdcAmount))
      .accounts({
        saleState,
        vesting: vestingAccount,
        buyer: buyer.publicKey,
        buyerUsdcAccount,
        usdcTreasury,
        vectVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    console.log("Buy USDC tx:", tx);

    // Verify vesting account
    const vestingData = await program.account.vesting.fetch(vestingAccount);
    assert.equal(
      vestingData.beneficiary.toString(),
      buyer.publicKey.toString()
    );
    assert.equal(vestingData.totalVectAmount.toNumber(), expectedVectAmount);
    assert.equal(vestingData.claimedAmount.toNumber(), 0);
    console.log(
      "✅ Purchased",
      expectedVectAmount,
      "VECT with",
      usdcAmount,
      "USDC"
    );

    // Verify treasury received USDC
    const treasuryAccount = await getAccount(provider.connection, usdcTreasury);
    assert.equal(treasuryAccount.amount.toString(), usdcAmount.toString());
  });

  it("Second buyer purchases VECT", async () => {
    const usdcAmount = 50 * 10 ** USDC_DECIMALS; // 50 USDC
    const expectedVectAmount = 1_000_000_000_000; // 1000 VECT

    const tx = await program.methods
      .buyWithUsdc(new anchor.BN(usdcAmount))
      .accounts({
        saleState,
        vesting: vesting2Account,
        buyer: buyer2.publicKey,
        buyerUsdcAccount: buyer2UsdcAccount,
        usdcTreasury,
        vectVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer2])
      .rpc();

    console.log("Second buy tx:", tx);

    // Verify vesting account
    const vestingData = await program.account.vesting.fetch(vesting2Account);
    assert.equal(
      vestingData.beneficiary.toString(),
      buyer2.publicKey.toString()
    );
    assert.equal(
      vestingData.totalVectAmount.toNumber(),
      expectedVectAmount
    );
    assert.equal(vestingData.claimedAmount.toNumber(), 0);
    console.log(
      "✅ Second buyer purchased",
      expectedVectAmount,
      "VECT with",
      usdcAmount,
      "USDC"
    );
  });

  it("Admin can pause the sale", async () => {
    const tx = await program.methods
      .pauseSale()
      .accounts({
        saleState,
        authority: authority.publicKey,
      })
      .rpc();

    console.log("Pause sale tx:", tx);

    const saleStateAccount = await program.account.saleState.fetch(saleState);
    assert.equal(saleStateAccount.isPaused, true);
    console.log("✅ Sale paused");
  });

  it("Cannot buy when paused", async () => {
    const usdcAmount = 10 * 10 ** USDC_DECIMALS;

    try {
      await program.methods
        .buyWithUsdc(new anchor.BN(usdcAmount))
        .accounts({
          saleState,
          vesting: vestingAccount,
          buyer: buyer.publicKey,
          buyerUsdcAccount,
          usdcTreasury,
          vectVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      assert.fail("Should have failed - sale is paused");
    } catch (error) {
      assert.include(error.toString(), "SaleIsPaused");
      console.log("✅ Correctly prevented purchase when paused");
    }
  });

  it("Admin can unpause the sale", async () => {
    const tx = await program.methods
      .unpauseSale()
      .accounts({
        saleState,
        authority: authority.publicKey,
      })
      .rpc();

    console.log("Unpause sale tx:", tx);

    const saleStateAccount = await program.account.saleState.fetch(saleState);
    assert.equal(saleStateAccount.isPaused, false);
    console.log("✅ Sale unpaused");
  });

  it("Admin can update price", async () => {
    const newPrice = 100_000; // 0.1 USDC per VECT

    const tx = await program.methods
      .updatePrice(new anchor.BN(newPrice))
      .accounts({
        saleState,
        authority: authority.publicKey,
      })
      .rpc();

    console.log("Update price tx:", tx);

    const saleStateAccount = await program.account.saleState.fetch(saleState);
    assert.equal(saleStateAccount.usdcPricePerVect.toNumber(), newPrice);
    console.log("✅ Price updated to", newPrice);

    // Reset price for other tests
    await program.methods
      .updatePrice(new anchor.BN(USDC_PRICE_PER_VECT))
      .accounts({
        saleState,
        authority: authority.publicKey,
      })
      .rpc();
  });

  it("Cannot claim before cliff", async () => {
    try {
      const buyerVectAccount = await anchor.utils.token.associatedAddress({
        mint: vectMint,
        owner: buyer.publicKey,
      });

      await program.methods
        .claim()
        .accounts({
          saleState,
          vesting: vestingAccount,
          beneficiary: buyer.publicKey,
          vectMint,
          beneficiaryVectAccount: buyerVectAccount,
          vectVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      assert.fail("Should have failed - cliff not reached");
    } catch (error) {
      assert.include(error.toString(), "CliffNotReached");
      console.log("✅ Correctly prevented claim before cliff");
    }
  });

  it("Admin withdraws USDC", async () => {
    // Create authority's USDC account if needed
    const authorityUsdcAccount = await createAccount(
      provider.connection,
      payer,
      usdcMint,
      authority.publicKey
    );

    const treasuryBefore = await getAccount(provider.connection, usdcTreasury);
    const withdrawAmount = treasuryBefore.amount / 2n; // Withdraw half

    const tx = await program.methods
      .withdrawUsdc(new anchor.BN(withdrawAmount.toString()))
      .accounts({
        saleState,
        authority: authority.publicKey,
        authorityUsdcAccount,
        usdcTreasury,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Withdraw USDC tx:", tx);

    // Verify withdrawal
    const treasuryAfter = await getAccount(provider.connection, usdcTreasury);
    const authorityBalance = await getAccount(
      provider.connection,
      authorityUsdcAccount
    );

    assert.equal(
      treasuryAfter.amount.toString(),
      (treasuryBefore.amount - withdrawAmount).toString()
    );
    assert.equal(authorityBalance.amount.toString(), withdrawAmount.toString());
    console.log("✅ Withdrew", withdrawAmount.toString(), "USDC");
  });

  it("Admin can end the sale", async () => {
    const tx = await program.methods
      .endSale()
      .accounts({
        saleState,
        authority: authority.publicKey,
      })
      .rpc();

    console.log("End sale tx:", tx);

    const saleStateAccount = await program.account.saleState.fetch(saleState);
    assert.equal(saleStateAccount.isEnded, true);
    assert.equal(saleStateAccount.isPaused, false);
    console.log("✅ Sale ended permanently");
  });

  it("Cannot buy when sale has ended", async () => {
    const usdcAmount = 10 * 10 ** USDC_DECIMALS;

    try {
      await program.methods
        .buyWithUsdc(new anchor.BN(usdcAmount))
        .accounts({
          saleState,
          vesting: vestingAccount,
          buyer: buyer.publicKey,
          buyerUsdcAccount,
          usdcTreasury,
          vectVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      assert.fail("Should have failed - sale has ended");
    } catch (error) {
      assert.include(error.toString(), "SaleHasEnded");
      console.log("✅ Correctly prevented purchase when sale ended");
    }
  });

  it("Fetch and display sale statistics", async () => {
    const saleStateAccount = await program.account.saleState.fetch(saleState);

    console.log("\n📊 Final Sale Statistics:");
    console.log("Total VECT Sold:", saleStateAccount.totalVectSold.toString());
    console.log(
      "Total USDC Raised:",
      saleStateAccount.totalUsdcRaised.toString()
    );
    console.log(
      "Price per VECT:",
      saleStateAccount.usdcPricePerVect.toString(),
      "USDC"
    );
    console.log("Sale Status: ENDED");

    assert.isTrue(saleStateAccount.totalVectSold.toNumber() > 0);
    assert.isTrue(saleStateAccount.totalUsdcRaised.toNumber() > 0);
    assert.equal(saleStateAccount.isEnded, true);
  });

  it("Display vesting schedule info", async () => {
    console.log("\n⏰ Vesting Schedule Information:");
    console.log("   - Cliff: 3 months (90 days)");
    console.log("   - Linear vesting: 12 months (365 days)");
    console.log("   - Minimum purchase: 10 USDC");
    console.log("   - Admin can pause/unpause/end sale");
    console.log("   - Admin can update price dynamically");
    console.log("   - Zero dust - 100% of tokens are claimable");
    console.log(
      "\n   In production, users would wait for their cliff period,"
    );
    console.log("   then call claim() periodically to receive vested tokens.");
  });
});
