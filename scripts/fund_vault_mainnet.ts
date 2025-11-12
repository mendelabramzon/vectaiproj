import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAccount, transfer } from "@solana/spl-token";
import fs from "fs";
import * as readline from "readline";

/**
 * Fund VECT Vault on Mainnet
 * 
 * Transfers VECT tokens from your wallet to the sale vault
 * 
 * Usage: ts-node scripts/fund_vault_mainnet.ts <AMOUNT_IN_VECT>
 * Example: ts-node scripts/fund_vault_mainnet.ts 1000000
 */

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

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const payer = provider.wallet as anchor.Wallet;

  // Check we're on mainnet
  const cluster = provider.connection.rpcEndpoint;
  if (!cluster.includes("mainnet")) {
    console.error("❌ ERROR: Not connected to mainnet!");
    console.error("Run: solana config set --url mainnet-beta");
    process.exit(1);
  }

  console.log("\n🚀 Funding VECT Vault on MAINNET");
  console.log("Cluster:", cluster);
  console.log("Authority:", payer.publicKey.toString());

  // Load mainnet config
  if (!fs.existsSync("scripts/.mainnet_config.json")) {
    console.error("❌ Mainnet config not found!");
    console.error("Run initialize_sale_mainnet.ts first");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("scripts/.mainnet_config.json", "utf-8"));
  const vectMint = new PublicKey(config.vectMint);
  const vectVault = new PublicKey(config.vectVault);

  console.log("\nVECT Mint:", vectMint.toString());
  console.log("VECT Vault:", vectVault.toString());

  // Get amount from command line or prompt
  let amountVect: number;
  if (process.argv[2]) {
    amountVect = parseFloat(process.argv[2]);
  } else {
    const rl = createReadlineInterface();
    const answer = await askQuestion(rl, "\nEnter amount of VECT to deposit: ");
    rl.close();
    amountVect = parseFloat(answer);
  }

  if (isNaN(amountVect) || amountVect <= 0) {
    console.error("❌ Invalid amount");
    process.exit(1);
  }

  const amountLamports = Math.floor(amountVect * 10 ** 6); // 6 decimals

  // Get your VECT token account
  const accounts = await provider.connection.getTokenAccountsByOwner(
    payer.publicKey,
    { mint: vectMint }
  );

  if (accounts.value.length === 0) {
    console.error("❌ You don't have a VECT token account!");
    process.exit(1);
  }

  const sourceAccount = accounts.value[0].pubkey;
  const sourceInfo = await getAccount(provider.connection, sourceAccount);
  const currentBalance = Number(sourceInfo.amount) / 10 ** 6;

  console.log("\n📊 Current Balances:");
  console.log(`Your VECT Balance: ${currentBalance.toLocaleString()} VECT`);
  console.log(`Amount to Transfer: ${amountVect.toLocaleString()} VECT`);

  if (Number(sourceInfo.amount) < amountLamports) {
    console.error("\n❌ Insufficient VECT balance!");
    console.error(`Need: ${amountVect} VECT`);
    console.error(`Have: ${currentBalance} VECT`);
    process.exit(1);
  }

  // Confirm
  const rl = createReadlineInterface();
  console.log("\n⚠️  WARNING: This will transfer VECT to the vault on MAINNET");
  const answer = await askQuestion(
    rl,
    `Type 'CONFIRM' to transfer ${amountVect.toLocaleString()} VECT: `
  );
  rl.close();

  if (answer.trim() !== "CONFIRM") {
    console.log("❌ Transfer cancelled");
    process.exit(0);
  }

  console.log("\n🚀 Transferring VECT to vault...");

  try {
    const signature = await transfer(
      provider.connection,
      payer.payer,
      sourceAccount,
      vectVault,
      payer.publicKey,
      amountLamports,
      [],
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );

    console.log("\n✅ Transfer successful!");
    console.log("Transaction:", signature);
    console.log("Explorer:", `https://explorer.solana.com/tx/${signature}`);

    // Verify vault balance
    const vaultInfo = await getAccount(provider.connection, vectVault);
    const vaultBalance = Number(vaultInfo.amount) / 10 ** 6;

    console.log("\n📊 Updated Balances:");
    console.log(`Vault Balance: ${vaultBalance.toLocaleString()} VECT`);
    console.log(`Your Balance: ${(currentBalance - amountVect).toLocaleString()} VECT`);

    console.log("\n🎉 Vault funded successfully!");
    console.log("\n📋 Next Steps:");
    console.log("1. Verify vault balance on explorer");
    console.log("2. Test a small purchase");
    console.log("3. Launch your sale!");

  } catch (error) {
    console.error("\n❌ Transfer failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

