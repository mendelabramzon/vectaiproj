import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import fs from "fs";

/**
 * Claim vested VECT tokens on Testnet
 * Usage: ts-node scripts/testnet_claim_tokens.ts
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("🎁 Claiming vested VECT tokens on TESTNET...");

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
  const vectVault = new PublicKey(config.vectVault);

  const beneficiary = provider.wallet as anchor.Wallet;

  console.log("Beneficiary:", beneficiary.publicKey.toString());

  // Derive vesting PDA
  const [vestingPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vesting"),
      saleState.toBuffer(),
      beneficiary.publicKey.toBuffer()
    ],
    program.programId
  );
  console.log("Vesting PDA:", vestingPDA.toString());

  // Check vesting account
  console.log("\n📊 Checking vesting account...");
  try {
    const vestingAccount = await (program.account as any).vesting.fetch(vestingPDA);
    const saleAccount = await (program.account as any).saleState.fetch(saleState);
    
    const totalVect = Number(vestingAccount.totalVectAmount) / 10 ** 6;
    const claimedVect = Number(vestingAccount.claimedAmount) / 10 ** 6;
    const startTime = new Date(Number(vestingAccount.startTime) * 1000);
    const cliffEnd = new Date((Number(vestingAccount.startTime) + Number(saleAccount.cliffDuration)) * 1000);
    const now = new Date();
    
    console.log("Total Purchased:", totalVect, "VECT");
    console.log("Already Claimed:", claimedVect, "VECT");
    console.log("Purchase Time:", startTime.toLocaleString());
    console.log("Cliff Ends At:", cliffEnd.toLocaleString());
    console.log("Current Time:", now.toLocaleString());
    
    const timeUntilCliff = cliffEnd.getTime() - now.getTime();
    if (timeUntilCliff > 0) {
      const minutesLeft = Math.ceil(timeUntilCliff / 1000 / 60);
      console.log(`\n⏱️  Cliff period: ${minutesLeft} minutes remaining`);
      console.log("Come back after", cliffEnd.toLocaleString());
      process.exit(0);
    } else {
      console.log("\n✅ Cliff period passed! Can claim now.");
    }

  } catch (error) {
    if (error.message?.includes("Account does not exist")) {
      console.error("\n❌ No vesting account found!");
      console.error("You need to purchase tokens first: yarn testnet:buy 10");
      process.exit(1);
    }
    throw error;
  }

  // Get or create beneficiary's VECT token account
  console.log("\n💰 Getting/creating VECT token account...");
  const beneficiaryVectAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    beneficiary.payer,
    vectMint,
    beneficiary.publicKey
  );
  console.log("VECT Account:", beneficiaryVectAccount.address.toString());

  // Execute claim
  console.log("\n🚀 Claiming tokens...");
  
  try {
    const tx = await program.methods
      .claim()
      .accounts({
        vesting: vestingPDA,
        saleState,
        beneficiary: beneficiary.publicKey,
        vectMint,
        vectVault,
        beneficiaryVectAccount: beneficiaryVectAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("\n✅ Claim successful!");
    console.log("Transaction:", tx);
    
    const explorerUrl = `https://explorer.solana.com/tx/${tx}?cluster=devnet`;
    console.log("Explorer:", explorerUrl);

    // Check updated balance
    const updatedAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      beneficiary.payer,
      vectMint,
      beneficiary.publicKey
    );
    
    console.log("\n📊 Updated Balance:");
    console.log("VECT Balance:", Number(updatedAccount.amount) / 10 ** 6, "VECT");
    
    console.log("\n🎉 Tokens claimed successfully!");
    console.log("💡 Tip: You can test again by buying more tokens!");

  } catch (error) {
    console.error("\n❌ Claim failed:", error);
    if (error.message?.includes("CliffNotReached")) {
      console.error("\n⏱️  Cliff period not yet passed. Wait 10 minutes from purchase time.");
    } else if (error.message?.includes("NothingToClaim")) {
      console.error("\n✅ You've already claimed all available tokens!");
    } else if (error.logs) {
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

