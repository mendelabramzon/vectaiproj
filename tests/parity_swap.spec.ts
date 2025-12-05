import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  createTransferInstruction,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { createHash } from "crypto";
import { assert } from "chai";

describe("parity_swap", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ParitySwap as Program;
  const mockProgram = anchor.workspace.MockSwap as Program;
  const MOCK_SWAP_PROGRAM_ID = mockProgram.programId;
  const authority = provider.wallet as anchor.Wallet;
  const payer = authority.payer;

  const DECIMALS = 6;
  const BUY_AMOUNT = 1_000_000n; // 1 token with 6 decimals

  let mintA: anchor.web3.PublicKey;
  let mintB: anchor.web3.PublicKey;
  let userSource: anchor.web3.PublicKey;
  let userDestination: anchor.web3.PublicKey;
  let poolSource: anchor.web3.PublicKey;
  let poolDestination: anchor.web3.PublicKey;

  const toRemainingAccounts = (
    keys: anchor.web3.AccountMeta[]
  ): anchor.web3.AccountMeta[] =>
    keys.map((k) => ({
      pubkey: k.pubkey,
      isWritable: k.isWritable,
      isSigner: k.isSigner,
    }));

  const buildMockSwapIx = async (
    from: PublicKey,
    to: PublicKey,
    amount: bigint
  ): Promise<anchor.web3.TransactionInstruction> => {
    return mockProgram.methods
      .swap(new BN(amount.toString()))
      .accounts({
        authority: authority.publicKey,
        from,
        to,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const primeBlockhash = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
      try {
        const sig = await provider.connection.requestAirdrop(
          authority.publicKey,
          1 * anchor.web3.LAMPORTS_PER_SOL
        );
        const latest = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
          signature: sig,
          ...latest,
        });
        return;
      } catch (e) {
        if (i === retries - 1) throw e;
        await sleep(500);
      }
    }
  };

  before(async () => {
    await primeBlockhash();

    mintA = await createMint(
      provider.connection,
      payer,
      authority.publicKey,
      null,
      DECIMALS
    );

    mintB = await createMint(
      provider.connection,
      payer,
      authority.publicKey,
      null,
      DECIMALS
    );

    await primeBlockhash();
    userSource = await createAccount(
      provider.connection,
      payer,
      mintA,
      authority.publicKey,
      Keypair.generate()
    );
    userDestination = await createAccount(
      provider.connection,
      payer,
      mintB,
      authority.publicKey,
      Keypair.generate()
    );

    await primeBlockhash();
    poolSource = await createAccount(
      provider.connection,
      payer,
      mintA,
      authority.publicKey,
      Keypair.generate()
    );
    poolDestination = await createAccount(
      provider.connection,
      payer,
      mintB,
      authority.publicKey,
      Keypair.generate()
    );

    // User starts with token A; pool starts with token B for buy path.
    await mintTo(
      provider.connection,
      payer,
      mintA,
      userSource,
      authority.publicKey,
      10_000_000n
    );
    await mintTo(
      provider.connection,
      payer,
      mintB,
      poolDestination,
      authority.publicKey,
      10_000_000n
    );
  });

  it("routes to buy path when sum is odd", async () => {
    const buyIx = await buildMockSwapIx(
      poolDestination,
      userDestination,
      BUY_AMOUNT
    );
    const sellIx = await buildMockSwapIx(
      userSource,
      poolSource,
      BUY_AMOUNT
    );

    const destinationBefore = (await getAccount(
      provider.connection,
      userDestination
    )).amount;

    await program.methods
      .executeParitySwap(
        [new BN(1), new BN(2)], // sum = 3 (odd)
        Buffer.from(buyIx.data),
        Buffer.from(sellIx.data),
        buyIx.keys.length
      )
      .accounts({
        authority: authority.publicKey,
        dexProgram: MOCK_SWAP_PROGRAM_ID,
      })
      .remainingAccounts([
        ...toRemainingAccounts(buyIx.keys),
        ...toRemainingAccounts(sellIx.keys),
      ])
      .rpc();

    const destinationAfter = (await getAccount(
      provider.connection,
      userDestination
    )).amount;

    assert.equal(
      destinationAfter - destinationBefore,
      BUY_AMOUNT,
      "Buy branch should credit user destination"
    );
  });

  it("routes to sell path when sum is even", async () => {
    const buyIx = await buildMockSwapIx(
      poolDestination,
      userDestination,
      BUY_AMOUNT
    );
    const sellIx = await buildMockSwapIx(
      userSource,
      poolSource,
      BUY_AMOUNT
    );

    const userSourceBefore = (await getAccount(
      provider.connection,
      userSource
    )).amount;
    const poolSourceBefore = (await getAccount(
      provider.connection,
      poolSource
    )).amount;

    await program.methods
      .executeParitySwap(
        [new BN(2), new BN(2)], // sum = 4 (even)
        Buffer.from(buyIx.data),
        Buffer.from(sellIx.data),
        buyIx.keys.length
      )
      .accounts({
        authority: authority.publicKey,
        dexProgram: MOCK_SWAP_PROGRAM_ID,
      })
      .remainingAccounts([
        ...toRemainingAccounts(buyIx.keys),
        ...toRemainingAccounts(sellIx.keys),
      ])
      .rpc();

    const userSourceAfter = (await getAccount(
      provider.connection,
      userSource
    )).amount;
    const poolSourceAfter = (await getAccount(
      provider.connection,
      poolSource
    )).amount;

    assert.equal(
      userSourceBefore - userSourceAfter,
      BUY_AMOUNT,
      "Sell branch should debit user source"
    );
    assert.equal(
      poolSourceAfter - poolSourceBefore,
      BUY_AMOUNT,
      "Sell branch should credit pool source"
    );
  });
});

