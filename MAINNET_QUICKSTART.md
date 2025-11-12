# 🚀 Mainnet Deployment Quick Start

**Ready-to-deploy checklist for your VECT token vesting sale on Solana mainnet.**

---

## ⚡ Quick Commands

```bash
# 1. Configure for mainnet
solana config set --url mainnet-beta
solana config set --keypair ~/.config/solana/mainnet-deployer.json

# 2. Check balance (need 2-5 SOL)
solana balance

# 3. Build program
anchor build

# 4. Deploy to mainnet
anchor deploy --provider.cluster mainnet-beta

# 5. Initialize sale (with confirmation prompts)
yarn mainnet:init

# 6. Fund vault with VECT tokens
yarn mainnet:fund 1000000

# 7. Check status
yarn mainnet:status
```

---

## 📦 What You Have

### ✅ Program Features
- **Buy with USDC only** (no SOL complexity)
- **90-day cliff** → 100% unlock immediately after
- **0.2 USDC per VECT** (configurable)
- **10 USDC minimum** purchase (prevents dust)
- **Pause/unpause** capability
- **Price updates** (change price anytime)
- **Safe withdrawals** (USDC treasury)
- **End sale** functionality

### ✅ Token Configuration
- **VECT Token**: `J7gr5uPExeRmTc6GdVNyXj4zmYdXmYLYFC5TkkDngm4x`
- **Decimals**: 6 (verified ✓)
- **USDC**: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

### ✅ Security Features
- Checked arithmetic (overflow protection)
- Checks-Effects-Interactions pattern
- Access control (authority-only functions)
- Parameter validation
- Decimal precision handling

---

## 📁 Files Created for You

### Deployment Scripts
- ✅ `scripts/initialize_sale_mainnet.ts` - Initialize sale on mainnet
- ✅ `scripts/fund_vault_mainnet.ts` - Fund vault with VECT
- ✅ `scripts/view_sale_status.ts` - View live statistics

### Admin Scripts
- ✅ `scripts/admin_pause.ts` - Emergency pause
- ✅ `scripts/admin_unpause.ts` - Resume sale
- ✅ `scripts/admin_update_price.ts` - Change token price
- ✅ `scripts/admin_withdraw_usdc.ts` - Withdraw funds

### Documentation
- ✅ `MAINNET_CHECKLIST.md` - Complete deployment guide
- ✅ `FRONTEND_INTEGRATION.md` - Frontend developer guide
- ✅ `DEPLOYMENT.md` - Detailed deployment docs

---

## 🎯 Deployment Steps

### Step 1: Pre-Flight Check (5 min)

```bash
# Verify everything builds
anchor build

# Check program size
ls -lh target/deploy/vectaiproj.so

# Backup keypair
cp target/deploy/vectaiproj-keypair.json ~/backups/
```

### Step 2: Configure Mainnet (2 min)

```bash
# Set cluster
solana config set --url mainnet-beta

# Set your funded keypair
solana config set --keypair ~/.config/solana/mainnet-deployer.json

# Verify (CRITICAL - double check)
solana config get

# Should show:
# RPC URL: https://api.mainnet-beta.solana.com
# Keypair Path: /path/to/mainnet-deployer.json
```

### Step 3: Deploy Program (5 min)

```bash
# Deploy (costs ~2-3 SOL)
anchor deploy --provider.cluster mainnet-beta

# Program ID should be:
# ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf

# Verify on explorer
solana program show ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf
```

### Step 4: Initialize Sale (3 min)

```bash
# Run initialization script
yarn mainnet:init

# You'll be prompted to confirm:
# - VECT token address
# - USDC address
# - Cliff: 90 days
# - Vesting: 1 second (instant)
# - Price: 0.2 USDC

# Type: CONFIRM MAINNET DEPLOYMENT

# ✅ Saves config to scripts/.mainnet_config.json
```

### Step 5: Fund Vault (2 min)

```bash
# Transfer 1M VECT to vault (adjust as needed)
yarn mainnet:fund 1000000

# Type: CONFIRM

# Verify vault balance
spl-token accounts J7gr5uPExeRmTc6GdVNyXj4zmYdXmYLYFC5TkkDngm4x
```

### Step 6: Verify Deployment (2 min)

```bash
# Check everything
yarn mainnet:status

# Should show:
# - Sale active (not paused/ended)
# - Vault balance = your amount
# - Price = 0.2 USDC
# - Total sold = 0 (new sale)
```

### Step 7: Test Purchase (5 min)

**Important**: Test with a small amount first!

```bash
# Use a test wallet
# Buy 10 USDC worth (minimum)
# Verify transaction succeeds
# Check vesting account created
```

---

## 🎬 Launch!

### Soft Launch (Recommended)

```bash
# Option 1: Start paused
yarn admin:pause

# Announce to small group
# Monitor for 24-48 hours
# If all good:
yarn admin:unpause
```

### Full Launch

1. **Announce** on social media
2. **Monitor** closely for first hour
3. **Be ready** to pause if issues
4. **Respond** to user questions
5. **Track** metrics

---

## 🛠️ Admin Commands

### View Status
```bash
yarn mainnet:status
```

### Pause Sale (Emergency)
```bash
yarn admin:pause
```

### Unpause Sale
```bash
yarn admin:unpause
```

### Update Price
```bash
# Example: Change to 0.15 USDC
yarn admin:update-price 150000
```

### Withdraw USDC
```bash
# Example: Withdraw 1000 USDC
yarn admin:withdraw 1000
```

---

## 📊 What Happens in Your Sale

### User Buys 100 USDC Worth

**Purchase (Day 0)**:
- User pays: 100 USDC
- User receives: 500 VECT (100 / 0.2)
- Vesting starts: Immediately
- Status: Locked (cliff period)

**During Cliff (Days 1-89)**:
- User tries to claim → ❌ "Cliff not reached"
- All tokens remain locked
- No partial unlocks

**After Cliff (Day 90)**:
- User claims → ✅ Receives all 500 VECT
- 100% unlocked immediately
- Done!

---

## 🔐 Security Checklist

### Before Launch
- [ ] Program deployed to correct address
- [ ] Sale initialized with correct parameters
- [ ] USDC address verified (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
- [ ] Vault funded with correct amount
- [ ] Test purchase successful
- [ ] Authority keypair backed up securely
- [ ] Monitoring alerts configured

### After Launch
- [ ] Watch first transactions closely
- [ ] Monitor vault balance
- [ ] Check for failed transactions
- [ ] Respond to user issues quickly
- [ ] Regular status checks

---

## 🆘 Emergency Procedures

### Something Goes Wrong

1. **Pause immediately**:
   ```bash
   yarn admin:pause
   ```

2. **Investigate**:
   - Check transaction logs
   - Review program accounts
   - Identify issue

3. **Fix**:
   - Update price if needed
   - Withdraw USDC if necessary
   - End sale if critical issue

4. **Resume** (only when safe):
   ```bash
   yarn admin:unpause
   ```

### Contact Information
- **Solana Discord**: https://discord.gg/solana
- **Status Page**: https://status.solana.com

---

## 💻 Frontend Integration (Later)

When ready to build your frontend:

1. Read `FRONTEND_INTEGRATION.md`
2. Use `scripts/.mainnet_config.json` for addresses
3. Test on devnet first
4. Deploy frontend
5. Connect to your deployed program

**Key Features to Implement**:
- ✅ Connect wallet (Phantom, Solflare, etc.)
- ✅ Display sale statistics
- ✅ Buy tokens with USDC
- ✅ View user's vesting schedule
- ✅ Claim tokens (after cliff)
- ✅ Transaction confirmations
- ✅ Error handling

---

## 📈 Success Metrics

Monitor these after launch:

- **Total USDC Raised**: Track revenue
- **Total VECT Sold**: Track adoption
- **Number of Buyers**: Track users
- **Average Purchase Size**: Track behavior
- **Claim Rate** (after cliff): Track engagement

---

## ✅ Final Checklist

Before announcing your sale:

- [ ] Program deployed ✓
- [ ] Sale initialized ✓
- [ ] Vault funded ✓
- [ ] Test purchase successful ✓
- [ ] Status verified ✓
- [ ] Admin commands tested ✓
- [ ] Monitoring ready ✓
- [ ] Team briefed ✓
- [ ] Support ready ✓
- [ ] Announcement prepared ✓

---

## 🎉 You're Ready!

Your token vesting sale is production-ready and secure.

**Total deployment time**: ~30 minutes  
**Cost**: ~2-5 SOL for deployment + operations

**Questions?** Check the detailed guides:
- `MAINNET_CHECKLIST.md` - Step-by-step deployment
- `DEPLOYMENT.md` - Comprehensive guide
- `FRONTEND_INTEGRATION.md` - Developer guide

**Good luck with your launch!** 🚀

