import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createAccount, getAccount } from "@solana/spl-token";
import fs from "fs";

/**
 * Script to buy VECT tokens with USDC
 * Usage: ts-node scripts/buy_tokens.ts <usdc_amount> [buyer_keypair_path]
 */

async function main() {
  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // Load IDL manually
  const idl = JSON.parse(
    fs.readFileSync("target/idl/vesting_sale.json", "utf-8")
  );
  const programId = new PublicKey("ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf");
  // Set the address in the IDL
  idl.address = programId.toString();
  const program = new Program(idl as any, provider);

  console.log("🛒 Buying VECT tokens with USDC...");

  // Load sale configuration
  if (!fs.existsSync("scripts/.sale_config.json")) {
    console.error("❌ Sale config not found. Run 'ts-node scripts/initialize_sale.ts' first");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("scripts/.sale_config.json", "utf-8"));
  const saleState = new PublicKey(config.saleState);
  const vectVault = new PublicKey(config.vectVault);
  const usdcTreasury = new PublicKey(config.usdcTreasury);
  const usdcMint = new PublicKey(config.usdcMint);

  // Get buyer (use provider wallet or load from keypair)
  const args = process.argv.slice(2);
  const usdcAmount = args[0] ? parseFloat(args[0]) : 10; // Default 10 USDC
  const amount = Math.floor(usdcAmount * 10 ** 6); // Convert to base units

  let buyer: anchor.Wallet;
  if (args[1]) {
    const keypairPath = args[1];
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    buyer = new anchor.Wallet(keypair);
  } else {
    buyer = provider.wallet as anchor.Wallet;
  }

  console.log("Buyer:", buyer.publicKey.toString());
  console.log("Amount:", usdcAmount, "USDC");

  // Get or create buyer's USDC account
  let buyerUsdcAccount: PublicKey;
  try {
    // Try to find existing account
    const accounts = await provider.connection.getParsedTokenAccountsByOwner(
      buyer.publicKey,
      { mint: usdcMint }
    );
    
    if (accounts.value.length > 0) {
      buyerUsdcAccount = accounts.value[0].pubkey;
    } else {
      // Create new account
      buyerUsdcAccount = await createAccount(
        provider.connection,
        (provider.wallet as anchor.Wallet).payer,
        usdcMint,
        buyer.publicKey
      );
      console.log("Created buyer USDC account:", buyerUsdcAccount.toString());
    }
  } catch (error) {
    console.error("Error getting/creating USDC account:", error);
    throw error;
  }

  // Check buyer's USDC balance
  const buyerAccount = await getAccount(provider.connection, buyerUsdcAccount);
  console.log("Buyer USDC balance:", Number(buyerAccount.amount) / 10 ** 6, "USDC");

  if (Number(buyerAccount.amount) < amount) {
    console.error("❌ Insufficient USDC balance");
    process.exit(1);
  }

  // Derive vesting PDA
  const [vestingAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vesting"),
      saleState.toBuffer(),
      buyer.publicKey.toBuffer(),
    ],
    program.programId
  );

  console.log("Vesting account:", vestingAccount.toString());

  // Calculate expected VECT amount
  const expectedVect = usdcAmount * 20; // 1 USDC = 20 VECT
  console.log("Expected VECT:", expectedVect);

  try {
    const tx = await program.methods
      .buyWithUsdc(new anchor.BN(amount))
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
      .signers(buyer === provider.wallet ? [] : [buyer.payer])
      .rpc();

    console.log("\n✅ Purchase successful!");
    console.log("Transaction:", tx);

    // Fetch vesting info
    const vestingData = await (program.account as any).vesting.fetch(vestingAccount);
    console.log("\n📊 Vesting Info:");
    console.log("Total VECT amount:", Number(vestingData.totalVectAmount) / 10 ** 9);
    console.log("Claimed amount:", Number(vestingData.claimedAmount) / 10 ** 9);
    console.log("Start time:", new Date(vestingData.startTime.toNumber() * 1000).toLocaleString());

  } catch (error) {
    console.error("❌ Error buying tokens:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

