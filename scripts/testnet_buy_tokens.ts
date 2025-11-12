import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import fs from "fs";

/**
 * Buy VECT tokens with USDC on Testnet
 * Usage: ts-node scripts/testnet_buy_tokens.ts <usdc_amount>
 * Example: ts-node scripts/testnet_buy_tokens.ts 10
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("🛒 Buying VECT tokens with USDC on TESTNET...");

  // Load testnet configuration
  if (!fs.existsSync("scripts/.testnet_config.json")) {
    console.error("❌ Testnet config not found. Run 'yarn testnet:init' first");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("scripts/.testnet_config.json", "utf-8"));
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync("target/idl/vesting_sale.json", "utf-8"));
  const programId = new PublicKey(config.programId);
  idl.address = programId.toString();
  const program = new Program(idl as any, provider);

  const saleState = new PublicKey(config.saleState);
  const vectMint = new PublicKey(config.vectMint);
  const usdcMint = new PublicKey(config.usdcMint);
  const vectVault = new PublicKey(config.vectVault);
  const usdcTreasury = new PublicKey(config.usdcTreasury);

  // Get USDC amount from args
  const args = process.argv.slice(2);
  const usdcAmount = args[0] ? parseFloat(args[0]) : 10;
  const amountLamports = Math.floor(usdcAmount * 10 ** 6);

  const buyer = provider.wallet as anchor.Wallet;

  console.log("Buyer:", buyer.publicKey.toString());
  console.log("Amount:", usdcAmount, "USDC");

  // Get or create buyer's USDC token account
  console.log("\n💰 Getting/creating USDC token account...");
  const buyerUsdcAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    buyer.payer,
    usdcMint,
    buyer.publicKey
  );
  console.log("USDC Account:", buyerUsdcAccount.address.toString());
  console.log("USDC Balance:", Number(buyerUsdcAccount.amount) / 10 ** 6, "USDC");

  if (Number(buyerUsdcAccount.amount) < amountLamports) {
    console.error("\n❌ Insufficient USDC balance!");
    console.error(`Need: ${usdcAmount} USDC`);
    console.error(`Have: ${Number(buyerUsdcAccount.amount) / 10 ** 6} USDC`);
    process.exit(1);
  }

  // Derive vesting PDA
  const [vestingPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vesting"),
      saleState.toBuffer(),
      buyer.publicKey.toBuffer()
    ],
    program.programId
  );
  console.log("Vesting PDA:", vestingPDA.toString());

  // Execute purchase
  console.log("\n🚀 Executing purchase...");
  
  try {
    const tx = await program.methods
      .buyWithUsdc(new anchor.BN(amountLamports))
      .accounts({
        saleState,
        vesting: vestingPDA,
        buyer: buyer.publicKey,
        vectMint,
        usdcMint,
        vectVault,
        usdcTreasury,
        buyerUsdcAccount: buyerUsdcAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("\n✅ Purchase successful!");
    console.log("Transaction:", tx);
    
    const explorerUrl = `https://explorer.solana.com/tx/${tx}?cluster=devnet`;
    console.log("Explorer:", explorerUrl);

    // Calculate VECT amount
    const vectAmount = (amountLamports * 10 ** 6) / config.usdcPricePerVect;
    
    console.log("\n📊 Purchase Summary:");
    console.log("Paid:", usdcAmount, "USDC");
    console.log("Purchased:", vectAmount / 10 ** 6, "VECT");
    console.log("Price:", config.usdcPricePerVect / 1_000_000, "USDC per VECT");
    
    console.log("\n⏱️  Next Steps:");
    console.log("1. Wait 10 minutes for cliff period");
    console.log("2. Run: yarn testnet:claim");
    console.log("3. You'll receive all", vectAmount / 10 ** 6, "VECT immediately!");

  } catch (error) {
    console.error("\n❌ Purchase failed:", error);
    if (error.logs) {
      console.error("\nProgram logs:");
      error.logs.forEach((log: string) => console.error(log));
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

