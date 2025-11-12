import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, getAccount } from "@solana/spl-token";
import fs from "fs";

/**
 * Withdraw USDC from treasury
 * Only authority can execute this
 * 
 * Usage: ts-node scripts/admin_withdraw_usdc.ts <AMOUNT>
 * Example: ts-node scripts/admin_withdraw_usdc.ts 1000  (1000 USDC)
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
  const usdcMint = new PublicKey(config.usdcMint);
  const usdcTreasury = new PublicKey(config.usdcTreasury);

  if (!process.argv[2]) {
    console.error("❌ Missing amount argument");
    console.error("Usage: ts-node scripts/admin_withdraw_usdc.ts <AMOUNT>");
    console.error("Example: ts-node scripts/admin_withdraw_usdc.ts 1000");
    process.exit(1);
  }

  const amountUsdc = parseFloat(process.argv[2]);
  if (isNaN(amountUsdc) || amountUsdc <= 0) {
    console.error("❌ Invalid amount");
    process.exit(1);
  }

  const amountLamports = Math.floor(amountUsdc * 10 ** 6); // 6 decimals

  // Get treasury balance
  const treasuryInfo = await getAccount(provider.connection, usdcTreasury);
  const treasuryBalance = Number(treasuryInfo.amount) / 10 ** 6;

  console.log("💰 Withdrawing USDC from treasury...");
  console.log("Treasury Balance:", treasuryBalance.toLocaleString(), "USDC");
  console.log("Withdraw Amount:", amountUsdc.toLocaleString(), "USDC");

  if (Number(treasuryInfo.amount) < amountLamports) {
    console.error("\n❌ Insufficient treasury balance!");
    console.error(`Need: ${amountUsdc} USDC`);
    console.error(`Have: ${treasuryBalance} USDC`);
    process.exit(1);
  }

  // Get or create authority's USDC account
  const authorityUsdcAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    authority.payer,
    usdcMint,
    authority.publicKey
  );

  console.log("Authority USDC Account:", authorityUsdcAccount.address.toString());

  const tx = await program.methods
    .withdrawUsdc(new anchor.BN(amountLamports))
    .accounts({
      saleState,
      authority: authority.publicKey,
      usdcMint,
      usdcTreasury,
      authorityUsdcAccount: authorityUsdcAccount.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log("\n✅ USDC withdrawn!");
  console.log("Transaction:", tx);
  console.log("Explorer:", `https://explorer.solana.com/tx/${tx}`);

  // Show updated balances
  const newTreasuryInfo = await getAccount(provider.connection, usdcTreasury);
  const newTreasuryBalance = Number(newTreasuryInfo.amount) / 10 ** 6;
  
  const authorityInfo = await getAccount(provider.connection, authorityUsdcAccount.address);
  const authorityBalance = Number(authorityInfo.amount) / 10 ** 6;

  console.log("\n📊 Updated Balances:");
  console.log("Treasury:", newTreasuryBalance.toLocaleString(), "USDC");
  console.log("Your Account:", authorityBalance.toLocaleString(), "USDC");
}

main().then(() => process.exit(0)).catch(console.error);

