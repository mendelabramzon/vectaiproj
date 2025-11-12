import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import fs from "fs";

/**
 * View testnet sale status
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  if (!fs.existsSync("scripts/.testnet_config.json")) {
    console.error("❌ Testnet config not found! Run: yarn testnet:init");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("scripts/.testnet_config.json", "utf-8"));
  
  const idl = JSON.parse(fs.readFileSync("target/idl/vesting_sale.json", "utf-8"));
  const programId = new PublicKey(config.programId);
  idl.address = programId.toString();
  const program = new Program(idl as any, provider);

  const saleState = new PublicKey(config.saleState);
  const vectVault = new PublicKey(config.vectVault);
  const usdcTreasury = new PublicKey(config.usdcTreasury);

  console.log("\n" + "=".repeat(70));
  console.log("📊 TESTNET SALE STATUS");
  console.log("=".repeat(70) + "\n");

  const saleData = await (program.account as any).saleState.fetch(saleState);
  const vaultInfo = await getAccount(provider.connection, vectVault);
  const treasuryInfo = await getAccount(provider.connection, usdcTreasury);

  const vaultBalance = Number(vaultInfo.amount) / 10 ** 6;
  const treasuryBalance = Number(treasuryInfo.amount) / 10 ** 6;
  const totalSold = Number(saleData.totalVectSold) / 10 ** 6;
  const totalRaised = Number(saleData.totalUsdcRaised) / 10 ** 6;

  console.log("🌐 NETWORK:");
  console.log("─".repeat(70));
  console.log("Cluster:", config.network);
  console.log("Program ID:", config.programId);
  console.log("Sale State:", saleState.toString());
  console.log("");

  console.log("⚙️  CONFIGURATION:");
  console.log("─".repeat(70));
  console.log("Cliff Duration:", Number(saleData.cliffDuration), "seconds (10 minutes) ⏱️");
  console.log("Vesting Duration:", Number(saleData.vestingDuration), "second (instant)");
  console.log("Price:", Number(saleData.usdcPricePerVect) / 1_000_000, "USDC per VECT");
  console.log("Min Purchase: 10 USDC");
  console.log("");

  console.log("📈 STATISTICS:");
  console.log("─".repeat(70));
  console.log("Total VECT Sold:", totalSold.toLocaleString(), "VECT");
  console.log("Total USDC Raised:", totalRaised.toLocaleString(), "USDC");
  console.log("VECT Remaining:", vaultBalance.toLocaleString(), "VECT");
  console.log("USDC in Treasury:", treasuryBalance.toLocaleString(), "USDC");
  console.log("");

  console.log("🔧 STATUS:");
  console.log("─".repeat(70));
  console.log("Paused:", saleData.isPaused ? "🛑 YES" : "✅ NO");
  console.log("Ended:", saleData.isEnded ? "🏁 YES" : "✅ NO");
  
  const status = saleData.isEnded 
    ? "🏁 ENDED" 
    : saleData.isPaused 
    ? "🛑 PAUSED" 
    : "✅ ACTIVE";
  console.log("Current Status:", status);
  console.log("");

  console.log("🔗 EXPLORER:");
  console.log("─".repeat(70));
  const cluster = config.network === "devnet" ? "?cluster=devnet" : "";
  console.log("Sale State:", `https://explorer.solana.com/address/${saleState}${cluster}`);
  console.log("VECT Vault:", `https://explorer.solana.com/address/${vectVault}${cluster}`);
  console.log("");

  console.log("💡 TESTING GUIDE:");
  console.log("─".repeat(70));
  console.log("1. Buy tokens: yarn buy 10");
  console.log("2. Wait 10 minutes ⏱️");
  console.log("3. Claim: yarn claim");
  console.log("4. Repeat for more tests!");
  console.log("");

  console.log("=".repeat(70) + "\n");
}

main().then(() => process.exit(0)).catch(console.error);

