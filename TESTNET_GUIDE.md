# 🧪 Testnet Deployment Guide

Fast testing environment with **10-minute cliff** for rapid iteration.

---

## 🎯 Key Differences: Testnet vs Mainnet

| Feature | Testnet | Mainnet |
|---------|---------|---------|
| **Cliff Duration** | **10 minutes** ⏱️ | 90 days |
| **Vesting** | 1 second (instant) | 1 second (instant) |
| **VECT Token** | **Created by you** | Your existing token |
| **USDC Token** | **Created by you** | Official USDC |
| **Cost** | **FREE** (faucet SOL) | ~3 SOL |
| **Purpose** | Fast testing | Production |

---

## ⚡ Quick Start (5 minutes)

```bash
# 1. Configure for devnet
solana config set --url devnet

# 2. Get free SOL
solana airdrop 2

# 3. Build & deploy
anchor build
anchor deploy --provider.cluster devnet

# 4. Create test tokens (VECT + USDC)
yarn testnet:create-tokens

# 5. Initialize sale (10-minute cliff)
yarn testnet:init

# 6. Fund vault
yarn testnet:fund 1000000

# 7. Buy tokens
yarn buy 10

# 8. Wait 10 minutes ⏱️

# 9. Claim tokens
yarn claim

# 10. Done! Repeat for more tests 🎉
```

---

## 📋 Detailed Steps

### Step 1: Configure Environment

```bash
# Set to devnet
solana config set --url devnet

# Verify
solana config get
# Should show: RPC URL: https://api.devnet.solana.com

# Check balance
solana balance

# If < 1 SOL, request airdrop
solana airdrop 2
```

### Step 2: Build & Deploy Program

```bash
# Build
anchor build

# Deploy to devnet (FREE with airdrop SOL)
anchor deploy --provider.cluster devnet

# Verify
solana program show ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf --url devnet
```

**Note:** The program ID is the same across all networks (determined by the keypair).

### Step 3: Create Test Tokens

```bash
yarn testnet:create-tokens
```

**What this does:**
- Creates VECT test token (6 decimals)
- Creates USDC test token (6 decimals)
- Mints 10M VECT to your wallet
- Mints 1M USDC to your wallet
- Saves config to `scripts/.testnet_tokens.json`

**Output:**
```
✅ VECT Mint created: <ADDRESS>
✅ USDC Mint created: <ADDRESS>
✅ Minted 10000000 VECT to authority
✅ Minted 1000000 USDC to authority
```

### Step 4: Initialize Sale

```bash
yarn testnet:init
```

**Parameters:**
- **Cliff**: 10 minutes (600 seconds)
- **Vesting**: 1 second (instant unlock)
- **Price**: 0.2 USDC per VECT
- **Min Purchase**: 10 USDC

**Output:**
```
✅ Sale initialized successfully!
📝 Configuration saved to scripts/.testnet_config.json
```

### Step 5: Fund Vault

```bash
# Fund with 1M VECT (or specify amount)
yarn testnet:fund 1000000

# Or custom amount
yarn testnet:fund 500000
```

**Output:**
```
✅ Transfer successful!
Vault Balance: 1,000,000 VECT
```

### Step 6: Check Status

```bash
yarn testnet:status
```

**Shows:**
- Sale configuration
- Token balances
- Total sold/raised
- Pause/end status
- Explorer links

### Step 7: Test Purchase

**Option A: Use buy script**
```bash
# Buy 10 USDC worth (minimum)
yarn buy 10

# Buy 100 USDC worth
yarn buy 100
```

**Option B: Manual purchase**
```bash
ts-node scripts/buy_tokens.ts 50
```

**Expected Result:**
- USDC transferred to treasury
- Vesting account created
- Tokens locked for 10 minutes

### Step 8: Wait for Cliff

**⏱️ Wait 10 minutes!**

- Get coffee ☕
- Check status: `yarn testnet:status`
- View on explorer: `https://explorer.solana.com/address/<SALE_STATE>?cluster=devnet`

**Timeline:**
```
00:00 - Purchase tokens (locked)
00:05 - Still locked (5 min remaining)
00:10 - Cliff reached! Can claim ✅
00:11+ - Can claim anytime
```

### Step 9: Claim Tokens

```bash
# After 10 minutes
yarn claim
```

**Expected Result:**
- All purchased VECT transferred to your wallet
- 100% unlocked immediately
- Can verify with: `spl-token accounts <VECT_MINT>`

### Step 10: Repeat!

The beauty of testnet:
```bash
# Test again immediately
yarn buy 20        # Buy more
# Wait 10 minutes
yarn claim         # Claim

# Test different scenarios
yarn admin:pause   # Pause sale
yarn buy 10        # Should fail ✅
yarn admin:unpause # Resume
yarn buy 10        # Should work ✅
```

---

## 🧪 Test Scenarios

### Scenario 1: Basic Purchase & Claim

```bash
1. yarn buy 10
2. Wait 10 minutes ⏱️
3. yarn claim
4. Check balance: spl-token accounts <VECT_MINT>
```

### Scenario 2: Multiple Purchases

```bash
1. yarn buy 10   # First purchase
2. yarn buy 20   # Second purchase (adds to vesting)
3. Wait 10 minutes
4. yarn claim    # Claim all 30 VECT worth
```

### Scenario 3: Early Claim (Should Fail)

```bash
1. yarn buy 10
2. yarn claim    # Immediately (should fail: "Cliff not reached")
3. Wait 10 minutes
4. yarn claim    # Should work ✅
```

### Scenario 4: Pause/Unpause

```bash
1. yarn admin:pause
2. yarn buy 10           # Should fail: "Sale is paused"
3. yarn admin:unpause
4. yarn buy 10           # Should work ✅
```

### Scenario 5: Price Update

```bash
1. yarn admin:update-price 100000  # Change to 0.1 USDC
2. yarn buy 10                     # Get 100 VECT now (was 50)
3. yarn admin:update-price 200000  # Change back
```

### Scenario 6: Below Minimum (Should Fail)

```bash
1. yarn buy 5    # Should fail: "Below minimum purchase"
2. yarn buy 10   # Should work ✅
```

---

## 📊 Monitoring & Debugging

### Check Sale Status

```bash
yarn testnet:status
```

**Output includes:**
- Network info
- Sale parameters
- Statistics (sold, raised, remaining)
- Current status
- Explorer links

### Check Token Balances

```bash
# Your VECT balance
spl-token balance <VECT_MINT>

# Vault balance
spl-token accounts <VECT_MINT>
# Look for vault address

# Your USDC balance
spl-token balance <USDC_MINT>
```

### View on Explorer

All transactions and accounts visible at:
```
https://explorer.solana.com/address/<ADDRESS>?cluster=devnet
```

Replace `<ADDRESS>` with:
- Program ID
- Sale State PDA
- Vault address
- Your vesting PDA
- Transaction signatures

---

## 🐛 Troubleshooting

### Issue: Airdrop Failed

```bash
# Try different amounts
solana airdrop 1
solana airdrop 0.5

# Or use devnet faucet
# https://faucet.solana.com/
```

### Issue: "Cliff not reached"

```bash
# Check elapsed time
# Must wait full 10 minutes from purchase

# Check your vesting account creation time
solana account <VESTING_PDA> --url devnet
```

### Issue: "Insufficient balance"

```bash
# Check balances
spl-token accounts

# Mint more test tokens
ts-node scripts/testnet_create_tokens.ts  # Creates new tokens
```

### Issue: "Account already initialized"

```bash
# Sale already initialized
# Either:
# 1. Use existing: yarn testnet:status
# 2. Create new with different authority
# 3. Deploy new program instance
```

---

## 🔄 Reset & Start Over

If you want to completely reset:

```bash
# 1. Clean build
anchor clean

# 2. Rebuild
anchor build

# 3. Deploy fresh
anchor deploy --provider.cluster devnet

# 4. Create new tokens
yarn testnet:create-tokens

# 5. Initialize new sale
yarn testnet:init

# 6. Fund vault
yarn testnet:fund 1000000

# Done! Fresh start 🎉
```

---

## 📝 Configuration Files

### `.testnet_tokens.json`
Created by: `yarn testnet:create-tokens`

Contains:
- VECT mint address
- USDC mint address
- Your token accounts
- Creation timestamp

### `.testnet_config.json`
Created by: `yarn testnet:init`

Contains:
- Program ID
- Sale State PDA
- Vault & Treasury addresses
- Sale parameters
- Transaction signatures

**Note:** These files are git-ignored (`.gitignore`) and won't be committed.

---

## ⏱️ Timeline Reference

**10-Minute Cliff Testing:**

```
T+0:00  │ Buy tokens
        │ Status: Locked 🔒
        │
T+2:30  │ 25% of cliff elapsed
        │ Status: Still locked 🔒
        │
T+5:00  │ 50% of cliff elapsed
        │ Status: Still locked 🔒
        │
T+7:30  │ 75% of cliff elapsed
        │ Status: Still locked 🔒
        │
T+10:00 │ Cliff reached!
        │ Status: 100% claimable ✅
        │
T+10:01+│ Can claim anytime
        │ Status: 100% claimable ✅
```

---

## 🎓 Learning Objectives

Use testnet to:

1. **Understand the flow**: Buy → Wait → Claim
2. **Test edge cases**: Early claim, pausing, price changes
3. **Verify calculations**: Price × amount = tokens
4. **Check error handling**: Minimum purchase, cliff period
5. **Practice admin functions**: Pause, update price, withdraw
6. **Prepare for mainnet**: Confidence before real deployment

---

## ✅ Testnet Checklist

Before moving to mainnet:

- [ ] Successfully deployed to devnet
- [ ] Created test tokens
- [ ] Initialized sale
- [ ] Funded vault
- [ ] Tested purchase
- [ ] Tested claim (after 10 min)
- [ ] Tested multiple purchases
- [ ] Tested pause/unpause
- [ ] Tested price update
- [ ] Tested withdrawal
- [ ] Verified all calculations correct
- [ ] No errors in any flow
- [ ] Comfortable with process

---

## 🚀 Moving to Mainnet

Once testnet testing is complete:

1. **Review** all test results
2. **Read** `MAINNET_QUICKSTART.md`
3. **Prepare** real VECT tokens
4. **Fund** mainnet wallet (3-5 SOL)
5. **Deploy** to mainnet
6. **Use** 90-day cliff (not 10 minutes!)

---

## 💡 Tips

- **Test everything**: Don't skip scenarios
- **Wait full 10 minutes**: Cliff must fully elapse
- **Use multiple wallets**: Test as different users
- **Check explorer**: Verify all transactions
- **Monitor logs**: Watch for errors
- **Document issues**: Note any problems found
- **Iterate quickly**: 10-minute cliff = fast testing!

---

## 📞 Need Help?

- **Check docs**: README.md, DEPLOYMENT.md
- **View status**: `yarn testnet:status`
- **Check logs**: Look at transaction logs in explorer
- **Solana Discord**: https://discord.gg/solana

---

**Happy Testing!** 🧪🚀

The 10-minute cliff makes testnet perfect for rapid iteration and verification before mainnet deployment.

