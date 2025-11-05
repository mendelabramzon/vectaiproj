import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAccount } from "@solana/spl-token";
import fs from "fs";

/**
 * Script to claim vested VECT tokens
 * Usage: ts-node scripts/claim_tokens.ts [beneficiary_keypair_path]
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

  console.log("🎁 Claiming vested VECT tokens...");

  // Load sale configuration
  if (!fs.existsSync("scripts/.sale_config.json")) {
    console.error("❌ Sale config not found. Run 'ts-node scripts/initialize_sale.ts' first");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("scripts/.sale_config.json", "utf-8"));
  const saleState = new PublicKey(config.saleState);
  const vectVault = new PublicKey(config.vectVault);
  const vectMint = new PublicKey(config.vectMint);

  // Get beneficiary (use provider wallet or load from keypair)
  const args = process.argv.slice(2);
  let beneficiary: anchor.Wallet;
  
  if (args[0]) {
    const keypairPath = args[0];
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    beneficiary = new anchor.Wallet(keypair);
  } else {
    beneficiary = provider.wallet as anchor.Wallet;
  }

  console.log("Beneficiary:", beneficiary.publicKey.toString());

  // Derive vesting PDA
  const [vestingAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vesting"),
      saleState.toBuffer(),
      beneficiary.publicKey.toBuffer(),
    ],
    program.programId
  );

  console.log("Vesting account:", vestingAccount.toString());

  // Fetch vesting info
  try {
    const vestingData = await (program.account as any).vesting.fetch(vestingAccount);
    const saleStateData = await (program.account as any).saleState.fetch(saleState);
    
    console.log("\n📊 Vesting Info:");
    console.log("Total VECT amount:", Number(vestingData.totalVectAmount) / 10 ** 9);
    console.log("Claimed amount:", Number(vestingData.claimedAmount) / 10 ** 9);
    console.log("Start time:", new Date(vestingData.startTime.toNumber() * 1000).toLocaleString());
    
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - vestingData.startTime.toNumber();
    const cliffDuration = saleStateData.cliffDuration.toNumber();
    const vestingDuration = saleStateData.vestingDuration.toNumber();
    
    console.log("\n⏰ Time Info:");
    console.log("Current time:", new Date().toLocaleString());
    console.log("Elapsed:", Math.floor(elapsed / 86400), "days");
    console.log("Cliff duration:", Math.floor(cliffDuration / 86400), "days");
    console.log("Vesting duration:", Math.floor(vestingDuration / 86400), "days");
    
    if (elapsed < cliffDuration) {
      const daysUntilCliff = Math.ceil((cliffDuration - elapsed) / 86400);
      console.log(`\n⚠️  Cliff not reached yet. ${daysUntilCliff} days remaining.`);
      console.log("Cannot claim tokens until cliff period ends.");
      return;
    }

    // Calculate vested amount
    let vestedAmount: number;
    if (elapsed >= cliffDuration + vestingDuration) {
      vestedAmount = vestingData.totalVectAmount.toNumber();
    } else {
      const vestingElapsed = elapsed - cliffDuration;
      vestedAmount = Math.floor(
        (vestingData.totalVectAmount.toNumber() * vestingElapsed) / vestingDuration
      );
    }
    
    const claimable = vestedAmount - vestingData.claimedAmount.toNumber();
    console.log("\nVested amount:", vestedAmount / 10 ** 9, "VECT");
    console.log("Claimable now:", claimable / 10 ** 9, "VECT");
    
    if (claimable <= 0) {
      console.log("\n⚠️  No tokens available to claim at this time.");
      return;
    }

  } catch (error) {
    console.error("❌ Vesting account not found or error fetching data");
    console.error("Make sure you have purchased tokens first.");
    throw error;
  }

  // Derive beneficiary's VECT account (ATA)
  const beneficiaryVectAccount = await anchor.utils.token.associatedAddress({
    mint: vectMint,
    owner: beneficiary.publicKey,
  });

  console.log("\nBeneficiary VECT account:", beneficiaryVectAccount.toString());

  try {
    const tx = await program.methods
      .claim()
      .accounts({
        saleState,
        vesting: vestingAccount,
        beneficiary: beneficiary.publicKey,
        vectMint,
        beneficiaryVectAccount,
        vectVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers(beneficiary === provider.wallet ? [] : [beneficiary.payer])
      .rpc();

    console.log("\n✅ Claim successful!");
    console.log("Transaction:", tx);

    // Check new balance
    const beneficiaryAccount = await getAccount(provider.connection, beneficiaryVectAccount);
    console.log("New VECT balance:", Number(beneficiaryAccount.amount) / 10 ** 9, "VECT");

    // Fetch updated vesting info
    const vestingData = await (program.account as any).vesting.fetch(vestingAccount);
    console.log("\n📊 Updated Vesting Info:");
    console.log("Total VECT amount:", Number(vestingData.totalVectAmount) / 10 ** 9);
    console.log("Claimed amount:", Number(vestingData.claimedAmount) / 10 ** 9);
    console.log("Remaining:", (Number(vestingData.totalVectAmount) - Number(vestingData.claimedAmount)) / 10 ** 9);

  } catch (error) {
    console.error("❌ Error claiming tokens:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

