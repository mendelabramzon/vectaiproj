import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
} from "@solana/spl-token";
import fs from "fs";

/**
 * Script to create VECT and USDC test mints
 * Usage: ts-node scripts/create_mints.ts
 */

async function main() {
  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const payer = provider.wallet as anchor.Wallet;
  const authority = payer.publicKey;

  console.log("🏗️  Creating test mints...");
  console.log("Authority:", authority.toString());

  // Create VECT mint (9 decimals)
  const vectMint = await createMint(
    provider.connection,
    payer.payer,
    authority,
    null,
    9
  );
  console.log("✅ VECT Mint created:", vectMint.toString());

  // Create USDC mint (6 decimals)
  const usdcMint = await createMint(
    provider.connection,
    payer.payer,
    authority,
    null,
    6
  );
  console.log("✅ USDC Mint created:", usdcMint.toString());

  // Create authority's token accounts
  const authorityVectAccount = await createAccount(
    provider.connection,
    payer.payer,
    vectMint,
    authority
  );
  console.log("✅ Authority VECT account:", authorityVectAccount.toString());

  const authorityUsdcAccount = await createAccount(
    provider.connection,
    payer.payer,
    usdcMint,
    authority
  );
  console.log("✅ Authority USDC account:", authorityUsdcAccount.toString());

  // Mint initial supply
  const vectSupply = 10_000_000 * 10 ** 9; // 10M VECT
  await mintTo(
    provider.connection,
    payer.payer,
    vectMint,
    authorityVectAccount,
    authority,
    vectSupply
  );
  console.log("✅ Minted", vectSupply / 10 ** 9, "VECT to authority");

  const usdcSupply = 1_000_000 * 10 ** 6; // 1M USDC
  await mintTo(
    provider.connection,
    payer.payer,
    usdcMint,
    authorityUsdcAccount,
    authority,
    usdcSupply
  );
  console.log("✅ Minted", usdcSupply / 10 ** 6, "USDC to authority");

  // Save mint addresses to file
  const config = {
    vectMint: vectMint.toString(),
    usdcMint: usdcMint.toString(),
    authorityVectAccount: authorityVectAccount.toString(),
    authorityUsdcAccount: authorityUsdcAccount.toString(),
    authority: authority.toString(),
  };

  fs.writeFileSync(
    "scripts/.mints.json",
    JSON.stringify(config, null, 2)
  );
  console.log("\n📝 Mint configuration saved to scripts/.mints.json");
  console.log("\n🎉 All mints created successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

