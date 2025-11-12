import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";

/**
 * Initialize Sale on Testnet/Devnet
 * 
 * TESTNET PARAMETERS (for fast testing):
 * - Cliff: 10 minutes (600 seconds)
 * - Vesting: 1 second (instant unlock after cliff)
 * - Price: 0.2 USDC per VECT
 * 
 * Usage: ts-node scripts/testnet_initialize_sale.ts
 */

// ============================================================================
// TESTNET CONFIGURATION (Fast Testing)
// ============================================================================

const CLIFF_DURATION = 10 * 60;  // 10 minutes (600 seconds)
const VESTING_DURATION = 1;       // 1 second (instant unlock)
const USDC_PRICE_PER_VECT = 200_000; // 0.2 USDC per VECT

// ============================================================================

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("\n🚀 Initializing sale on TESTNET...");
  console.log("Cluster:", provider.connection.rpcEndpoint);

  // Verify we're NOT on mainnet
  if (provider.connection.rpcEndpoint.includes("mainnet")) {
    console.error("\n❌ ERROR: Detected mainnet! This script is for testnet only.");
    console.error("Run: solana config set --url devnet");
    process.exit(1);
  }

  const authority = provider.wallet as anchor.Wallet;
  console.log("Authority:", authority.publicKey.toString());

  // Load token configuration
  if (!fs.existsSync("scripts/.testnet_tokens.json")) {
    console.error("\n❌ Testnet tokens not found!");
    console.error("Run: yarn testnet:create-tokens");
    process.exit(1);
  }

  const tokenConfig = JSON.parse(fs.readFileSync("scripts/.testnet_tokens.json", "utf-8"));
  
  // Load IDL
  const idl = JSON.parse(
    fs.readFileSync("target/idl/vesting_sale.json", "utf-8")
  );
  const programId = new PublicKey("ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf");
  idl.address = programId.toString();
  const program = new Program(idl as any, provider);

  console.log("\n📍 Program ID:", program.programId.toString());

  const vectMint = new PublicKey(tokenConfig.vectMint);
  const usdcMint = new PublicKey(tokenConfig.usdcMint);

  console.log("VECT Mint:", vectMint.toString());
  console.log("USDC Mint:", usdcMint.toString());

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

  console.log("\n⚙️  Sale Parameters:");
  console.log("─".repeat(70));
  console.log("Cliff Duration:", CLIFF_DURATION, "seconds (10 minutes)");
  console.log("Vesting Duration:", VESTING_DURATION, "second (instant unlock)");
  console.log("Price:", USDC_PRICE_PER_VECT / 1_000_000, "USDC per VECT");
  console.log("Minimum Purchase: 10 USDC");
  console.log("─".repeat(70));

  console.log("\n⏱️  FAST TESTING MODE:");
  console.log("- Buy tokens now");
  console.log("- Wait 10 minutes");
  console.log("- Claim all tokens immediately!");
  console.log("");

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
    
    const explorerUrl = provider.connection.rpcEndpoint.includes("devnet")
      ? `https://explorer.solana.com/tx/${tx}?cluster=devnet`
      : `https://explorer.solana.com/tx/${tx}`;
    console.log("Explorer:", explorerUrl);

    // Save configuration
    const config = {
      ...tokenConfig,
      programId: program.programId.toString(),
      saleState: saleState.toString(),
      vectVault: vectVault.toString(),
      usdcTreasury: usdcTreasury.toString(),
      cliffDuration: CLIFF_DURATION,
      vestingDuration: VESTING_DURATION,
      usdcPricePerVect: USDC_PRICE_PER_VECT,
      deployedAt: new Date().toISOString(),
      txSignature: tx,
    };

    fs.writeFileSync(
      "scripts/.testnet_config.json",
      JSON.stringify(config, null, 2)
    );
    console.log("\n📝 Configuration saved to scripts/.testnet_config.json");

    console.log("\n" + "=".repeat(70));
    console.log("🎉 TESTNET SALE INITIALIZED!");
    console.log("=".repeat(70));
    console.log("\n📋 Next Steps:");
    console.log("1. Fund vault: yarn testnet:fund 1000000");
    console.log("2. Check status: yarn testnet:status");
    console.log("3. Test purchase: yarn buy 10");
    console.log("4. Wait 10 minutes ⏱️");
    console.log("5. Claim tokens: yarn claim");
    console.log("\n💡 Tip: You can test multiple times quickly!\n");

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

