import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import fs from "fs";

/**
 * View sale status and statistics
 * 
 * Usage: ts-node scripts/view_sale_status.ts
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const config = JSON.parse(fs.readFileSync("scripts/.mainnet_config.json", "utf-8"));
  
  const idl = JSON.parse(fs.readFileSync("target/idl/vesting_sale.json", "utf-8"));
  const programId = new PublicKey(config.programId);
  idl.address = programId.toString();
  const program = new Program(idl as any, provider);

  const saleState = new PublicKey(config.saleState);
  const vectVault = new PublicKey(config.vectVault);
  const usdcTreasury = new PublicKey(config.usdcTreasury);

  console.log("\n" + "=".repeat(70));
  console.log("📊 SALE STATUS");
  console.log("=".repeat(70) + "\n");

  // Fetch sale state
  const saleData = await program.account.saleState.fetch(saleState);

  // Fetch vault and treasury balances
  const vaultInfo = await getAccount(provider.connection, vectVault);
  const treasuryInfo = await getAccount(provider.connection, usdcTreasury);

  const vaultBalance = Number(vaultInfo.amount) / 10 ** 6; // 6 decimals
  const treasuryBalance = Number(treasuryInfo.amount) / 10 ** 6; // 6 decimals
  const totalSold = Number(saleData.totalVectSold) / 10 ** 6;
  const totalRaised = Number(saleData.totalUsdcRaised) / 10 ** 6;

  console.log("🏛️  PROGRAM INFORMATION:");
  console.log("─".repeat(70));
  console.log("Program ID:", config.programId);
  console.log("Sale State:", saleState.toString());
  console.log("Authority:", saleData.authority.toString());
  console.log("Deployed:", config.deployedAt);
  console.log("Network:", config.network);
  console.log("");

  console.log("💰 SALE CONFIGURATION:");
  console.log("─".repeat(70));
  console.log("VECT Token:", saleData.vectMint.toString());
  console.log("USDC Token:", saleData.usdcMint.toString());
  console.log("Price:", Number(saleData.usdcPricePerVect) / 1_000_000, "USDC per VECT");
  console.log("Cliff Duration:", Number(saleData.cliffDuration) / 86400, "days");
  console.log("Vesting Duration:", Number(saleData.vestingDuration), "seconds");
  console.log("Minimum Purchase: 10 USDC");
  console.log("");

  console.log("📈 SALE STATISTICS:");
  console.log("─".repeat(70));
  console.log("Total VECT Sold:", totalSold.toLocaleString(), "VECT");
  console.log("Total USDC Raised:", totalRaised.toLocaleString(), "USDC");
  console.log("VECT Remaining:", vaultBalance.toLocaleString(), "VECT");
  console.log("USDC in Treasury:", treasuryBalance.toLocaleString(), "USDC");
  console.log("");

  console.log("⚙️  SALE STATUS:");
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

  console.log("🔗 EXPLORER LINKS:");
  console.log("─".repeat(70));
  console.log("Program:", `https://explorer.solana.com/address/${config.programId}`);
  console.log("Sale State:", `https://explorer.solana.com/address/${saleState}`);
  console.log("VECT Vault:", `https://explorer.solana.com/address/${vectVault}`);
  console.log("USDC Treasury:", `https://explorer.solana.com/address/${usdcTreasury}`);
  console.log("");

  // Calculate additional metrics
  if (totalSold > 0) {
    const avgPrice = totalRaised / totalSold;
    console.log("📊 ADDITIONAL METRICS:");
    console.log("─".repeat(70));
    console.log("Average Sale Price:", avgPrice.toFixed(6), "USDC per VECT");
    
    if (vaultBalance > 0) {
      const percentageSold = (totalSold / (totalSold + vaultBalance) * 100);
      console.log("Percentage Sold:", percentageSold.toFixed(2) + "%");
    }
    console.log("");
  }

  console.log("=".repeat(70) + "\n");
}

main().then(() => process.exit(0)).catch(console.error);

