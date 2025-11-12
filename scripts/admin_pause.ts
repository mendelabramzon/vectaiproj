import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import fs from "fs";

/**
 * Pause the sale
 * Only authority can execute this
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

  console.log("🛑 Pausing sale...");
  console.log("Sale State:", saleState.toString());

  const tx = await program.methods
    .pauseSale()
    .accounts({
      saleState,
      authority: authority.publicKey,
    })
    .rpc();

  console.log("✅ Sale paused!");
  console.log("Transaction:", tx);
  console.log("Explorer:", `https://explorer.solana.com/tx/${tx}`);
}

main().then(() => process.exit(0)).catch(console.error);

