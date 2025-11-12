# Frontend Integration Guide

Guide for integrating the vesting sale program into your frontend application.

---

## 📋 Configuration

After mainnet deployment, use the generated `scripts/.mainnet_config.json`:

```typescript
// config/sale.ts
export const SALE_CONFIG = {
  // From .mainnet_config.json
  programId: "ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf",
  saleState: "...", // PDA from config
  vectVault: "...", // PDA from config
  usdcTreasury: "...", // PDA from config
  
  // Token addresses
  vectMint: "J7gr5uPExeRmTc6GdVNyXj4zmYdXmYLYFC5TkkDngm4x",
  usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  
  // Sale parameters
  cliffDays: 90,
  vestingSeconds: 1, // Instant unlock
  priceUsdc: 0.2,
  minPurchaseUsdc: 10,
  
  // Network
  network: "mainnet-beta",
  rpcUrl: "https://api.mainnet-beta.solana.com", // Or use Helius/QuickNode
};
```

---

## 🔌 Program Integration

### 1. Install Dependencies

```bash
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token @solana/wallet-adapter-react @solana/wallet-adapter-wallets
```

### 2. Load IDL

```typescript
// utils/program.ts
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "../idl/vesting_sale.json";
import { SALE_CONFIG } from "../config/sale";

export function getProgram(connection: Connection, wallet: any): Program {
  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );
  
  return new Program(idl as any, provider);
}
```

### 3. Derive PDAs

```typescript
// utils/pda.ts
import { PublicKey } from "@solana/web3.js";
import { SALE_CONFIG } from "../config/sale";

export function deriveVestingPDA(
  buyer: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("vesting"),
      new PublicKey(SALE_CONFIG.saleState).toBuffer(),
      buyer.toBuffer(),
    ],
    programId
  );
}
```

---

## 💰 Buy Tokens Function

```typescript
// hooks/useBuyTokens.ts
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getProgram, deriveVestingPDA } from "../utils";
import { SALE_CONFIG } from "../config/sale";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress 
} from "@solana/spl-token";
import BN from "bn.js";

export function useBuyTokens() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const buyTokens = async (usdcAmount: number) => {
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    // Convert USDC amount to lamports (6 decimals)
    const usdcLamports = Math.floor(usdcAmount * 1_000_000);

    const program = getProgram(connection, wallet);
    
    // Derive PDAs
    const [vestingPDA] = deriveVestingPDA(
      wallet.publicKey,
      program.programId
    );

    // Get token accounts
    const buyerUsdcAccount = await getAssociatedTokenAddress(
      new PublicKey(SALE_CONFIG.usdcMint),
      wallet.publicKey
    );

    // Execute purchase
    const tx = await program.methods
      .buyWithUsdc(new BN(usdcLamports))
      .accounts({
        saleState: new PublicKey(SALE_CONFIG.saleState),
        vesting: vestingPDA,
        buyer: wallet.publicKey,
        vectMint: new PublicKey(SALE_CONFIG.vectMint),
        usdcMint: new PublicKey(SALE_CONFIG.usdcMint),
        vectVault: new PublicKey(SALE_CONFIG.vectVault),
        usdcTreasury: new PublicKey(SALE_CONFIG.usdcTreasury),
        buyerUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  };

  return { buyTokens };
}
```

---

## 🎁 Claim Tokens Function

```typescript
// hooks/useClaimTokens.ts
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getProgram, deriveVestingPDA } from "../utils";
import { SALE_CONFIG } from "../config/sale";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

export function useClaimTokens() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const claimTokens = async () => {
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    const program = getProgram(connection, wallet);
    
    const [vestingPDA] = deriveVestingPDA(
      wallet.publicKey,
      program.programId
    );

    const beneficiaryVectAccount = await getAssociatedTokenAddress(
      new PublicKey(SALE_CONFIG.vectMint),
      wallet.publicKey
    );

    const tx = await program.methods
      .claim()
      .accounts({
        vesting: vestingPDA,
        saleState: new PublicKey(SALE_CONFIG.saleState),
        beneficiary: wallet.publicKey,
        vectMint: new PublicKey(SALE_CONFIG.vectMint),
        vectVault: new PublicKey(SALE_CONFIG.vectVault),
        beneficiaryVectAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  };

  return { claimTokens };
}
```

---

## 📊 Fetch User Vesting Data

```typescript
// hooks/useVestingData.ts
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { getProgram, deriveVestingPDA } from "../utils";
import { SALE_CONFIG } from "../config/sale";

export interface VestingData {
  totalVect: number;
  claimedVect: number;
  claimableVect: number;
  startTime: Date;
  cliffEndTime: Date;
  fullyVestedTime: Date;
  isCliffReached: boolean;
  isFullyVested: boolean;
}

export function useVestingData() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [vestingData, setVestingData] = useState<VestingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet.publicKey) {
      setVestingData(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const program = getProgram(connection, wallet);
        const [vestingPDA] = deriveVestingPDA(
          wallet.publicKey!,
          program.programId
        );

        // Fetch vesting account
        const vestingAccount = await program.account.vesting.fetch(vestingPDA);
        
        // Fetch sale state for cliff/vesting info
        const saleState = await program.account.saleState.fetch(
          new PublicKey(SALE_CONFIG.saleState)
        );

        const now = Date.now() / 1000; // Current time in seconds
        const startTime = vestingAccount.startTime.toNumber();
        const cliffDuration = saleState.cliffDuration.toNumber();
        const vestingDuration = saleState.vestingDuration.toNumber();

        const cliffEndTime = startTime + cliffDuration;
        const fullyVestedTime = cliffEndTime + vestingDuration;

        const isCliffReached = now >= cliffEndTime;
        const isFullyVested = now >= fullyVestedTime;

        // Calculate claimable amount
        let claimableVect = 0;
        if (isCliffReached) {
          if (isFullyVested) {
            // All tokens unlocked
            claimableVect = vestingAccount.totalVectAmount.toNumber() - 
                           vestingAccount.claimedAmount.toNumber();
          } else {
            // Partially vested
            const elapsed = now - cliffEndTime;
            const vestedAmount = Math.floor(
              (vestingAccount.totalVectAmount.toNumber() * elapsed) / vestingDuration
            );
            claimableVect = vestedAmount - vestingAccount.claimedAmount.toNumber();
          }
        }

        setVestingData({
          totalVect: vestingAccount.totalVectAmount.toNumber() / 1e6,
          claimedVect: vestingAccount.claimedAmount.toNumber() / 1e6,
          claimableVect: claimableVect / 1e6,
          startTime: new Date(startTime * 1000),
          cliffEndTime: new Date(cliffEndTime * 1000),
          fullyVestedTime: new Date(fullyVestedTime * 1000),
          isCliffReached,
          isFullyVested,
        });
      } catch (error) {
        console.error("Error fetching vesting data:", error);
        setVestingData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [connection, wallet.publicKey]);

  return { vestingData, loading };
}
```

---

## 📊 Fetch Sale Statistics

```typescript
// hooks/useSaleStats.ts
import { useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { SALE_CONFIG } from "../config/sale";
import idl from "../idl/vesting_sale.json";

export interface SaleStats {
  totalVectSold: number;
  totalUsdcRaised: number;
  vectRemaining: number;
  isPaused: boolean;
  isEnded: boolean;
  priceUsdc: number;
}

export function useSaleStats() {
  const { connection } = useConnection();
  const [stats, setStats] = useState<SaleStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Create minimal provider-like object for Program
        const program = new Program(
          idl as any,
          new PublicKey(SALE_CONFIG.programId),
          { connection } as any
        );

        const saleState = await program.account.saleState.fetch(
          new PublicKey(SALE_CONFIG.saleState)
        );

        const vaultInfo = await getAccount(
          connection,
          new PublicKey(SALE_CONFIG.vectVault)
        );

        setStats({
          totalVectSold: saleState.totalVectSold.toNumber() / 1e6,
          totalUsdcRaised: saleState.totalUsdcRaised.toNumber() / 1e6,
          vectRemaining: Number(vaultInfo.amount) / 1e6,
          isPaused: saleState.isPaused,
          isEnded: saleState.isEnded,
          priceUsdc: saleState.usdcPricePerVect.toNumber() / 1e6,
        });
      } catch (error) {
        console.error("Error fetching sale stats:", error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Update every 15s
    return () => clearInterval(interval);
  }, [connection]);

  return { stats };
}
```

---

## 🎨 Example UI Component

```typescript
// components/TokenSale.tsx
import { useBuyTokens, useClaimTokens, useVestingData, useSaleStats } from "../hooks";
import { useState } from "react";

export function TokenSale() {
  const [usdcAmount, setUsdcAmount] = useState(10);
  const { buyTokens } = useBuyTokens();
  const { claimTokens } = useClaimTokens();
  const { vestingData, loading: vestingLoading } = useVestingData();
  const { stats } = useSaleStats();

  const handleBuy = async () => {
    try {
      const tx = await buyTokens(usdcAmount);
      alert(`Purchase successful! TX: ${tx}`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleClaim = async () => {
    try {
      const tx = await claimTokens();
      alert(`Claim successful! TX: ${tx}`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      <h1>VECT Token Sale</h1>
      
      {/* Sale Stats */}
      <div>
        <h2>Sale Statistics</h2>
        <p>Price: {stats?.priceUsdc} USDC per VECT</p>
        <p>Sold: {stats?.totalVectSold.toLocaleString()} VECT</p>
        <p>Raised: ${stats?.totalUsdcRaised.toLocaleString()}</p>
        <p>Remaining: {stats?.vectRemaining.toLocaleString()} VECT</p>
        <p>Status: {stats?.isPaused ? "Paused" : stats?.isEnded ? "Ended" : "Active"}</p>
      </div>

      {/* Purchase Section */}
      <div>
        <h2>Buy VECT</h2>
        <input
          type="number"
          value={usdcAmount}
          onChange={(e) => setUsdcAmount(Number(e.target.value))}
          min={10}
        />
        <span>USDC</span>
        <p>You will receive: {(usdcAmount / (stats?.priceUsdc || 0.2)).toFixed(2)} VECT</p>
        <button onClick={handleBuy}>Buy Now</button>
      </div>

      {/* Vesting Info */}
      {vestingData && (
        <div>
          <h2>Your Vesting</h2>
          <p>Total Purchased: {vestingData.totalVect.toLocaleString()} VECT</p>
          <p>Already Claimed: {vestingData.claimedVect.toLocaleString()} VECT</p>
          <p>Claimable Now: {vestingData.claimableVect.toLocaleString()} VECT</p>
          <p>Cliff Ends: {vestingData.cliffEndTime.toLocaleDateString()}</p>
          
          {vestingData.isCliffReached ? (
            <button onClick={handleClaim} disabled={vestingData.claimableVect === 0}>
              Claim Tokens
            </button>
          ) : (
            <p>Tokens locked until cliff period ends</p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 🔐 Error Handling

Common errors and how to handle them:

```typescript
// utils/errors.ts
export function parseError(error: any): string {
  if (error.message?.includes("BelowMinimumPurchase")) {
    return "Minimum purchase is 10 USDC";
  }
  if (error.message?.includes("CliffNotReached")) {
    return "Tokens are still in cliff period";
  }
  if (error.message?.includes("SaleIsPaused")) {
    return "Sale is currently paused";
  }
  if (error.message?.includes("SaleHasEnded")) {
    return "Sale has ended";
  }
  if (error.message?.includes("InsufficientVaultBalance")) {
    return "Not enough tokens remaining in sale";
  }
  if (error.message?.includes("NothingToClaim")) {
    return "No tokens available to claim yet";
  }
  return error.message || "An error occurred";
}
```

---

## 🧪 Testing on Devnet

Before mainnet frontend launch:

1. Deploy to devnet first
2. Test all frontend functions
3. Verify calculations are correct
4. Test error handling
5. Check mobile responsiveness

---

## 📚 Resources

- **Solana Web3.js Docs**: https://solana-labs.github.io/solana-web3.js/
- **Anchor Docs**: https://www.anchor-lang.com/
- **Wallet Adapter**: https://github.com/solana-labs/wallet-adapter
- **SPL Token**: https://spl.solana.com/token

---

## ✅ Pre-Launch Checklist

- [ ] All functions tested
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Transaction confirmations shown
- [ ] Explorer links provided
- [ ] Mobile responsive
- [ ] Security review completed
- [ ] User documentation ready

