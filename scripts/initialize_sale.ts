import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";

/**
 * Script to initialize the vesting sale
 * Usage: ts-node scripts/initialize_sale.ts
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
  
  const authority = provider.wallet as anchor.Wallet;

  console.log("🚀 Initializing vesting sale...");
  console.log("Program ID:", program.programId.toString());
  console.log("Authority:", authority.publicKey.toString());

  // Load mint configuration
  if (!fs.existsSync("scripts/.mints.json")) {
    console.error("❌ Mints not found. Run 'ts-node scripts/create_mints.ts' first");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("scripts/.mints.json", "utf-8"));
  const vectMint = new PublicKey(config.vectMint);
  const usdcMint = new PublicKey(config.usdcMint);

  console.log("VECT Mint:", vectMint.toString());
  console.log("USDC Mint:", usdcMint.toString());

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

  // Sale parameters
  const CLIFF_DURATION = 90 * 24 * 60 * 60; // 3 months
  const VESTING_DURATION = 1; // 1 second = instant unlock after cliff
  const USDC_PRICE_PER_VECT = 200_000; // 0.2 USDC per VECT (both have 6 decimals)

  console.log("\n⚙️  Sale Parameters:");
  console.log("Cliff Duration:", CLIFF_DURATION, "seconds (3 months)");
  console.log("Vesting Duration:", VESTING_DURATION, "second (instant unlock after cliff)");
  console.log("Price:", USDC_PRICE_PER_VECT / 1_000_000, "USDC per VECT");
  console.log("Minimum Purchase: 10 USDC");

  // Initialize sale
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

    console.log("\n✅ Sale initialized!");
    console.log("Transaction:", tx);

    // Save sale configuration
    const saleConfig = {
      ...config,
      saleState: saleState.toString(),
      vectVault: vectVault.toString(),
      usdcTreasury: usdcTreasury.toString(),
      cliffDuration: CLIFF_DURATION,
      vestingDuration: VESTING_DURATION,
      usdcPricePerVect: USDC_PRICE_PER_VECT,
    };

    fs.writeFileSync(
      "scripts/.sale_config.json",
      JSON.stringify(saleConfig, null, 2)
    );
    console.log("📝 Sale configuration saved to scripts/.sale_config.json");

  } catch (error) {
    console.error("❌ Error initializing sale:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

