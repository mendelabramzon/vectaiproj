import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAccount } from "@solana/spl-token";
import fs from "fs";

/**
 * Script to fund the VECT vault
 * Usage: ts-node scripts/fund_vault.ts <amount>
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

  console.log("💰 Funding VECT vault...");

  // Load sale configuration
  if (!fs.existsSync("scripts/.sale_config.json")) {
    console.error("❌ Sale config not found. Run 'ts-node scripts/initialize_sale.ts' first");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("scripts/.sale_config.json", "utf-8"));
  const saleState = new PublicKey(config.saleState);
  const vectVault = new PublicKey(config.vectVault);
  const authorityVectAccount = new PublicKey(config.authorityVectAccount);

  // Get amount from command line or use default
  const args = process.argv.slice(2);
  const amountVect = args[0] ? parseFloat(args[0]) : 1_000_000; // Default 1M VECT
  const amount = Math.floor(amountVect * 10 ** 9); // Convert to base units

  console.log("Amount to fund:", amountVect, "VECT");

  // Check authority balance
  const authorityAccount = await getAccount(provider.connection, authorityVectAccount);
  console.log("Authority VECT balance:", Number(authorityAccount.amount) / 10 ** 9, "VECT");

  if (Number(authorityAccount.amount) < amount) {
    console.error("❌ Insufficient balance in authority account");
    process.exit(1);
  }

  try {
    const tx = await program.methods
      .adminFundVault(new anchor.BN(amount))
      .accounts({
        saleState,
        authority: authority.publicKey,
        adminVectAccount: authorityVectAccount,
        vectVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("\n✅ Vault funded!");
    console.log("Transaction:", tx);

    // Check new vault balance
    const vaultAccount = await getAccount(provider.connection, vectVault);
    console.log("Vault balance:", Number(vaultAccount.amount) / 10 ** 9, "VECT");

  } catch (error) {
    console.error("❌ Error funding vault:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

