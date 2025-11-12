import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import fs from "fs";

/**
 * Create Test Tokens for Testnet/Devnet
 * Creates VECT and USDC test tokens with 6 decimals each
 * 
 * Usage: ts-node scripts/testnet_create_tokens.ts
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const payer = provider.wallet as anchor.Wallet;
  const authority = payer.publicKey;

  console.log("\n🏗️  Creating test tokens for TESTNET...");
  console.log("Authority:", authority.toString());
  console.log("Cluster:", provider.connection.rpcEndpoint);

  // Verify we're NOT on mainnet
  if (provider.connection.rpcEndpoint.includes("mainnet")) {
    console.error("\n❌ ERROR: Detected mainnet! This script is for testnet only.");
    console.error("Run: solana config set --url devnet");
    process.exit(1);
  }

  // Check balance
  const balance = await provider.connection.getBalance(authority);
  const solBalance = balance / 1e9;
  console.log("SOL Balance:", solBalance.toFixed(4), "SOL");

  if (solBalance < 1) {
    console.log("\n💰 Low balance. Requesting airdrop...");
    try {
      const airdropSig = await provider.connection.requestAirdrop(
        authority,
        2 * 1e9 // 2 SOL
      );
      await provider.connection.confirmTransaction(airdropSig);
      console.log("✅ Airdrop successful!");
    } catch (error) {
      console.error("⚠️  Airdrop failed (rate limit?). Please fund manually.");
    }
  }

  console.log("\n📝 Creating VECT test token (6 decimals)...");
  
  // Create VECT test mint (6 decimals to match mainnet)
  const vectMint = await createMint(
    provider.connection,
    payer.payer,
    authority,
    null,
    6 // 6 decimals like mainnet
  );
  console.log("✅ VECT Mint created:", vectMint.toString());

  console.log("\n📝 Creating USDC test token (6 decimals)...");
  
  // Create USDC test mint (6 decimals)
  const usdcMint = await createMint(
    provider.connection,
    payer.payer,
    authority,
    null,
    6
  );
  console.log("✅ USDC Mint created:", usdcMint.toString());

  // Create authority's VECT token account
  const authorityVectAccount = await createAccount(
    provider.connection,
    payer.payer,
    vectMint,
    authority
  );
  console.log("\n✅ Authority VECT account:", authorityVectAccount.toString());

  // Create authority's USDC token account
  const authorityUsdcAccount = await createAccount(
    provider.connection,
    payer.payer,
    usdcMint,
    authority
  );
  console.log("✅ Authority USDC account:", authorityUsdcAccount.toString());

  // Mint VECT tokens (10M for testing)
  const vectSupply = 10_000_000 * 10 ** 6; // 10M VECT with 6 decimals
  await mintTo(
    provider.connection,
    payer.payer,
    vectMint,
    authorityVectAccount,
    authority,
    vectSupply
  );
  console.log("\n✅ Minted", vectSupply / 10 ** 6, "VECT to authority");

  // Mint USDC tokens (1M for testing)
  const usdcSupply = 1_000_000 * 10 ** 6; // 1M USDC with 6 decimals
  await mintTo(
    provider.connection,
    payer.payer,
    usdcMint,
    authorityUsdcAccount,
    authority,
    usdcSupply
  );
  console.log("✅ Minted", usdcSupply / 10 ** 6, "USDC to authority");

  // Verify balances
  const vectAccountInfo = await getAccount(provider.connection, authorityVectAccount);
  const usdcAccountInfo = await getAccount(provider.connection, authorityUsdcAccount);

  console.log("\n📊 Token Balances:");
  console.log("VECT:", Number(vectAccountInfo.amount) / 10 ** 6, "VECT");
  console.log("USDC:", Number(usdcAccountInfo.amount) / 10 ** 6, "USDC");

  // Save configuration
  const config = {
    network: provider.connection.rpcEndpoint.includes("devnet") ? "devnet" : "testnet",
    vectMint: vectMint.toString(),
    usdcMint: usdcMint.toString(),
    authorityVectAccount: authorityVectAccount.toString(),
    authorityUsdcAccount: authorityUsdcAccount.toString(),
    authority: authority.toString(),
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    "scripts/.testnet_tokens.json",
    JSON.stringify(config, null, 2)
  );
  console.log("\n📝 Configuration saved to scripts/.testnet_tokens.json");

  console.log("\n" + "=".repeat(70));
  console.log("🎉 Test tokens created successfully!");
  console.log("=".repeat(70));
  console.log("\n📋 Next Steps:");
  console.log("1. Build and deploy program: anchor build && anchor deploy --provider.cluster devnet");
  console.log("2. Initialize sale: yarn testnet:init");
  console.log("3. Fund vault: yarn testnet:fund 1000000");
  console.log("4. Test purchase: yarn buy 10 (or use test scripts)");
  console.log("5. Wait 10 minutes, then claim tokens!");
  console.log("\n⏱️  Testnet Parameters:");
  console.log("- Cliff: 10 minutes (for fast testing)");
  console.log("- Vesting: 1 second (instant unlock after cliff)");
  console.log("- Price: 0.2 USDC per VECT");
  console.log("- Min Purchase: 10 USDC\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

