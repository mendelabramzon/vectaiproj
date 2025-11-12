import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";
import * as readline from "readline";

/**
 * Mainnet Sale Initialization Script
 * 
 * CRITICAL: This script initializes your token sale on MAINNET
 * Review all parameters carefully before executing
 * 
 * Usage: ts-node scripts/initialize_sale_mainnet.ts
 */

// ============================================================================
// MAINNET CONFIGURATION
// ============================================================================

// Your existing VECT token on mainnet
const VECT_MINT = "J7gr5uPExeRmTc6GdVNyXj4zmYdXmYLYFC5TkkDngm4x";

// Official USDC on Solana mainnet (ALWAYS VERIFY THIS ADDRESS)
const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Sale Parameters
const CLIFF_DURATION = 90 * 24 * 60 * 60;  // 90 days (3 months)
const VESTING_DURATION = 1;                 // 1 second (instant unlock after cliff)
const USDC_PRICE_PER_VECT = 200_000;       // 0.2 USDC per VECT (both have 6 decimals)

// ============================================================================

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function confirmParameters(): Promise<boolean> {
  const rl = createReadlineInterface();

  console.log("\n" + "=".repeat(70));
  console.log("🚨 MAINNET DEPLOYMENT - REVIEW PARAMETERS CAREFULLY 🚨");
  console.log("=".repeat(70) + "\n");

  console.log("📋 Sale Configuration:");
  console.log("─".repeat(70));
  console.log(`VECT Token:           ${VECT_MINT}`);
  console.log(`USDC Token:           ${USDC_MAINNET}`);
  console.log(`Cliff Duration:       ${CLIFF_DURATION / 86400} days (${CLIFF_DURATION} seconds)`);
  console.log(`Vesting Duration:     ${VESTING_DURATION} second (instant unlock after cliff)`);
  console.log(`Price:                ${USDC_PRICE_PER_VECT / 1_000_000} USDC per VECT`);
  console.log(`Minimum Purchase:     10 USDC`);
  console.log("─".repeat(70) + "\n");

  console.log("💰 Example Purchase:");
  console.log(`  Pay: 100 USDC → Get: ${(100 * 1_000_000) / USDC_PRICE_PER_VECT} VECT`);
  console.log(`  Unlock: After 90 days, 100% immediately claimable\n`);

  console.log("⚠️  WARNING:");
  console.log("  - This will be deployed to MAINNET");
  console.log("  - Parameters CANNOT be changed after deployment");
  console.log("  - Ensure you have sufficient SOL for deployment (~1-2 SOL)");
  console.log("  - Ensure USDC address is correct (check multiple sources)");
  console.log("  - Ensure you have VECT tokens to fund the vault\n");

  const answer = await askQuestion(
    rl,
    "Type 'CONFIRM MAINNET DEPLOYMENT' to proceed (or anything else to cancel): "
  );
  rl.close();

  return answer.trim() === "CONFIRM MAINNET DEPLOYMENT";
}

async function main() {
  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("\n🔍 Checking connection...");
  const cluster = provider.connection.rpcEndpoint;
  console.log("Cluster:", cluster);

  // Verify we're on mainnet
  if (!cluster.includes("mainnet")) {
    console.error("\n❌ ERROR: Not connected to mainnet!");
    console.error("Run: solana config set --url mainnet-beta");
    process.exit(1);
  }

  const authority = provider.wallet as anchor.Wallet;
  console.log("Authority:", authority.publicKey.toString());

  // Check SOL balance
  const balance = await provider.connection.getBalance(authority.publicKey);
  const solBalance = balance / 1e9;
  console.log("SOL Balance:", solBalance.toFixed(4), "SOL");

  if (solBalance < 1) {
    console.error("\n❌ WARNING: Low SOL balance (< 1 SOL)");
    console.error("You may not have enough SOL for deployment + initialization");
  }

  // Get user confirmation
  const confirmed = await confirmParameters();
  if (!confirmed) {
    console.log("\n❌ Deployment cancelled by user");
    process.exit(0);
  }

  console.log("\n✅ Confirmation received. Proceeding with deployment...\n");

  // Load IDL
  const idl = JSON.parse(
    fs.readFileSync("target/idl/vesting_sale.json", "utf-8")
  );
  const programId = new PublicKey("ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf");
  idl.address = programId.toString();
  const program = new Program(idl as any, provider);

  console.log("📍 Program ID:", program.programId.toString());

  const vectMint = new PublicKey(VECT_MINT);
  const usdcMint = new PublicKey(USDC_MAINNET);

  // Verify token decimals
  console.log("\n🔍 Verifying token decimals...");
  const vectMintInfo = await provider.connection.getParsedAccountInfo(vectMint);
  const usdcMintInfo = await provider.connection.getParsedAccountInfo(usdcMint);

  const vectDecimals = (vectMintInfo.value?.data as any).parsed.info.decimals;
  const usdcDecimals = (usdcMintInfo.value?.data as any).parsed.info.decimals;

  console.log(`VECT decimals: ${vectDecimals} (expected: 6)`);
  console.log(`USDC decimals: ${usdcDecimals} (expected: 6)`);

  if (vectDecimals !== 6 || usdcDecimals !== 6) {
    console.error("\n❌ ERROR: Token decimal mismatch!");
    console.error("Both tokens must have 6 decimals");
    process.exit(1);
  }

  // Derive PDAs
  const [saleState] = PublicKey.findProgramAddressSync(
    [Buffer.from("sale"), authority.publicKey.toBuffer()],
    program.programId
  );

  const [vectVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vect_vault"), saleState.toBuffer()],
    program.programId
  );

  const [usdcTreasury] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_treasury"), saleState.toBuffer()],
    program.programId
  );

  console.log("\n📍 PDAs:");
  console.log("Sale State:", saleState.toString());
  console.log("VECT Vault:", vectVault.toString());
  console.log("USDC Treasury:", usdcTreasury.toString());

  console.log("\n🚀 Initializing sale on MAINNET...");

  try {
    const tx = await program.methods
      .initializeSale(
        new anchor.BN(CLIFF_DURATION),
        new anchor.BN(VESTING_DURATION),
        new anchor.BN(USDC_PRICE_PER_VECT)
      )
      .accounts({
        saleState,
        authority: authority.publicKey,
        vectMint,
        usdcMint,
        vectVault,
        usdcTreasury,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("\n✅ Sale initialized successfully!");
    console.log("Transaction:", tx);
    console.log("Explorer:", `https://explorer.solana.com/tx/${tx}`);

    // Save configuration
    const config = {
      network: "mainnet-beta",
      programId: program.programId.toString(),
      vectMint: vectMint.toString(),
      usdcMint: usdcMint.toString(),
      saleState: saleState.toString(),
      vectVault: vectVault.toString(),
      usdcTreasury: usdcTreasury.toString(),
      authority: authority.publicKey.toString(),
      cliffDuration: CLIFF_DURATION,
      vestingDuration: VESTING_DURATION,
      usdcPricePerVect: USDC_PRICE_PER_VECT,
      deployedAt: new Date().toISOString(),
      txSignature: tx,
    };

    fs.writeFileSync(
      "scripts/.mainnet_config.json",
      JSON.stringify(config, null, 2)
    );
    console.log("\n📝 Configuration saved to scripts/.mainnet_config.json");

    console.log("\n" + "=".repeat(70));
    console.log("🎉 MAINNET DEPLOYMENT COMPLETE!");
    console.log("=".repeat(70));
    console.log("\n📋 Next Steps:");
    console.log("1. Fund the vault: ts-node scripts/fund_vault_mainnet.ts <AMOUNT>");
    console.log("2. Verify on explorer: https://explorer.solana.com/address/" + saleState.toString());
    console.log("3. Test with small purchase first");
    console.log("4. Set up monitoring alerts");
    console.log("5. Build your frontend with the saved config\n");

    console.log("⚠️  IMPORTANT:");
    console.log("- Backup scripts/.mainnet_config.json securely");
    console.log("- Keep your authority keypair safe");
    console.log("- Consider transferring to multi-sig");
    console.log("- Monitor the sale closely after launch\n");

  } catch (error) {
    console.error("\n❌ Error initializing sale:", error);
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
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });

