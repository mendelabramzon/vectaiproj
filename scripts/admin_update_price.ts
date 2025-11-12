import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import fs from "fs";

/**
 * Update token price
 * Only authority can execute this
 * 
 * Usage: ts-node scripts/admin_update_price.ts <NEW_PRICE>
 * Example: ts-node scripts/admin_update_price.ts 150000  (0.15 USDC)
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const config = JSON.parse(fs.readFileSync("scripts/.mainnet_config.json", "utf-8"));
  
  const idl = JSON.parse(fs.readFileSync("target/idl/vesting_sale.json", "utf-8"));
  const programId = new PublicKey(config.programId);
  idl.address = programId.toString();
  const program = new Program(idl as any, provider);

  const authority = provider.wallet as anchor.Wallet;
  const saleState = new PublicKey(config.saleState);

  if (!process.argv[2]) {
    console.error("❌ Missing price argument");
    console.error("Usage: ts-node scripts/admin_update_price.ts <NEW_PRICE>");
    console.error("Example: ts-node scripts/admin_update_price.ts 150000");
    console.error("\nPrice examples:");
    console.error("  0.1 USDC = 100000");
    console.error("  0.15 USDC = 150000");
    console.error("  0.2 USDC = 200000");
    console.error("  0.5 USDC = 500000");
    console.error("  1 USDC = 1000000");
    process.exit(1);
  }

  const newPrice = parseInt(process.argv[2]);
  if (isNaN(newPrice) || newPrice <= 0) {
    console.error("❌ Invalid price");
    process.exit(1);
  }

  const oldPrice = config.usdcPricePerVect;
  
  console.log("💰 Updating token price...");
  console.log("Sale State:", saleState.toString());
  console.log(`Old Price: ${oldPrice / 1_000_000} USDC per VECT`);
  console.log(`New Price: ${newPrice / 1_000_000} USDC per VECT`);
  
  const change = ((newPrice - oldPrice) / oldPrice * 100).toFixed(2);
  console.log(`Change: ${change}%`);

  const tx = await program.methods
    .updatePrice(new anchor.BN(newPrice))
    .accounts({
      saleState,
      authority: authority.publicKey,
    })
    .rpc();

  console.log("\n✅ Price updated!");
  console.log("Transaction:", tx);
  console.log("Explorer:", `https://explorer.solana.com/tx/${tx}`);

  // Update config file
  config.usdcPricePerVect = newPrice;
  config.priceUpdatedAt = new Date().toISOString();
  fs.writeFileSync("scripts/.mainnet_config.json", JSON.stringify(config, null, 2));
  console.log("\n📝 Config file updated");
}

main().then(() => process.exit(0)).catch(console.error);

