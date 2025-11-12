import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAccount, transfer } from "@solana/spl-token";
import fs from "fs";

/**
 * Fund VECT Vault on Testnet
 * 
 * Usage: ts-node scripts/testnet_fund_vault.ts <AMOUNT_IN_VECT>
 * Example: ts-node scripts/testnet_fund_vault.ts 1000000
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const payer = provider.wallet as anchor.Wallet;

  console.log("\n💰 Funding VECT Vault on TESTNET");
  console.log("Cluster:", provider.connection.rpcEndpoint);
  console.log("Authority:", payer.publicKey.toString());

  // Verify we're NOT on mainnet
  if (provider.connection.rpcEndpoint.includes("mainnet")) {
    console.error("\n❌ ERROR: Detected mainnet! This script is for testnet only.");
    process.exit(1);
  }

  // Load testnet config
  if (!fs.existsSync("scripts/.testnet_config.json")) {
    console.error("❌ Testnet config not found!");
    console.error("Run: yarn testnet:init");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("scripts/.testnet_config.json", "utf-8"));
  const vectMint = new PublicKey(config.vectMint);
  const vectVault = new PublicKey(config.vectVault);

  console.log("\nVECT Mint:", vectMint.toString());
  console.log("VECT Vault:", vectVault.toString());

  // Get amount from command line
  let amountVect: number;
  if (process.argv[2]) {
    amountVect = parseFloat(process.argv[2]);
  } else {
    // Default: 1M VECT
    amountVect = 1_000_000;
    console.log("\nNo amount specified, using default: 1,000,000 VECT");
  }

  if (isNaN(amountVect) || amountVect <= 0) {
    console.error("❌ Invalid amount");
    process.exit(1);
  }

  const amountLamports = Math.floor(amountVect * 10 ** 6); // 6 decimals

  // Get your VECT token account
  const sourceAccount = new PublicKey(config.authorityVectAccount);
  const sourceInfo = await getAccount(provider.connection, sourceAccount);
  const currentBalance = Number(sourceInfo.amount) / 10 ** 6;

  console.log("\n📊 Current Balances:");
  console.log(`Your VECT Balance: ${currentBalance.toLocaleString()} VECT`);
  console.log(`Amount to Transfer: ${amountVect.toLocaleString()} VECT`);

  if (Number(sourceInfo.amount) < amountLamports) {
    console.error("\n❌ Insufficient VECT balance!");
    console.error(`Need: ${amountVect} VECT`);
    console.error(`Have: ${currentBalance} VECT`);
    process.exit(1);
  }

  console.log("\n🚀 Transferring VECT to vault...");

  try {
    const signature = await transfer(
      provider.connection,
      payer.payer,
      sourceAccount,
      vectVault,
      payer.publicKey,
      amountLamports,
      [],
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );

    console.log("\n✅ Transfer successful!");
    console.log("Transaction:", signature);
    
    const explorerUrl = provider.connection.rpcEndpoint.includes("devnet")
      ? `https://explorer.solana.com/tx/${signature}?cluster=devnet`
      : `https://explorer.solana.com/tx/${signature}`;
    console.log("Explorer:", explorerUrl);

    // Verify vault balance
    const vaultInfo = await getAccount(provider.connection, vectVault);
    const vaultBalance = Number(vaultInfo.amount) / 10 ** 6;

    console.log("\n📊 Updated Balances:");
    console.log(`Vault Balance: ${vaultBalance.toLocaleString()} VECT`);
    console.log(`Your Balance: ${(currentBalance - amountVect).toLocaleString()} VECT`);

    console.log("\n🎉 Vault funded successfully!");
    console.log("\n📋 Next Steps:");
    console.log("1. Check status: yarn testnet:status");
    console.log("2. Test purchase: yarn buy 10");
    console.log("3. Wait 10 minutes ⏱️");
    console.log("4. Claim tokens: yarn claim\n");

  } catch (error) {
    console.error("\n❌ Transfer failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

