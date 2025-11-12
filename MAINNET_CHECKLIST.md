# Mainnet Deployment Checklist

Quick reference for deploying your token vesting sale to Solana mainnet.

---

## ⚠️ Pre-Deployment Security

### 1. Code Audit
- [ ] All tests passing locally (`anchor test`)
- [ ] Code reviewed by senior developer
- [ ] Security audit completed (recommended for large sales)
- [ ] No hardcoded private keys
- [ ] All TODOs resolved

### 2. Keypair Security
- [ ] Created secure mainnet keypair
- [ ] Backed up to encrypted cloud storage
- [ ] Physical backup in safe location
- [ ] Never committed to git
- [ ] Using hardware wallet (recommended)

### 3. Token Preparation
- [ ] VECT token: `J7gr5uPExeRmTc6GdVNyXj4zmYdXmYLYFC5TkkDngm4x`
- [ ] Verified token has 6 decimals
- [ ] Sufficient VECT tokens available for sale
- [ ] Token account created and funded
- [ ] USDC address verified: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

---

## 🚀 Deployment Steps

### Step 1: Configure Solana CLI for Mainnet

```bash
# Set to mainnet
solana config set --url mainnet-beta

# Set your mainnet keypair
solana config set --keypair ~/.config/solana/mainnet-deployer.json

# Verify configuration
solana config get

# Check balance (need ~2-5 SOL)
solana balance
```

**Expected output:**
```
RPC URL: https://api.mainnet-beta.solana.com
Keypair Path: /Users/you/.config/solana/mainnet-deployer.json
```

### Step 2: Build Program

```bash
# Clean previous builds
anchor clean

# Build for mainnet
anchor build

# Verify program size (should be < 1MB for efficiency)
ls -lh target/deploy/vectaiproj.so
```

### Step 3: Deploy Program

```bash
# Deploy to mainnet (THIS COSTS SOL)
anchor deploy --provider.cluster mainnet-beta

# Save program ID
PROGRAM_ID=$(solana address -k target/deploy/vectaiproj-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Expected: ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf
```

**⚠️ CRITICAL:** Once deployed, the program ID is permanent. Backup `target/deploy/vectaiproj-keypair.json`!

### Step 4: Verify Deployment

```bash
# Check program on-chain
solana program show $PROGRAM_ID

# View on explorer
echo "https://explorer.solana.com/address/$PROGRAM_ID"

# Check if upgradeable
solana program show $PROGRAM_ID --programs
```

### Step 5: Initialize Sale

```bash
# Run mainnet initialization script
ts-node scripts/initialize_sale_mainnet.ts
```

**You will be prompted to confirm:**
- VECT Token: `J7gr5uPExeRmTc6GdVNyXj4zmYdXmYLYFC5TkkDngm4x`
- USDC Token: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Cliff: 90 days
- Vesting: 1 second (instant unlock after cliff)
- Price: 0.2 USDC per VECT

**Type:** `CONFIRM MAINNET DEPLOYMENT`

**Output:**
- Transaction signature
- Sale State PDA
- VECT Vault PDA
- USDC Treasury PDA
- Saves to `scripts/.mainnet_config.json`

### Step 6: Fund the Vault

```bash
# Transfer VECT to vault (example: 1M tokens)
ts-node scripts/fund_vault_mainnet.ts 1000000

# Type 'CONFIRM' when prompted
```

**Verify:**
```bash
# Check vault balance
spl-token accounts J7gr5uPExeRmTc6GdVNyXj4zmYdXmYLYFC5TkkDngm4x
```

### Step 7: Test Purchase (Optional but Recommended)

```bash
# Use a test wallet to buy small amount (10 USDC minimum)
# Verify purchase works correctly before announcing
```

---

## 📊 Post-Deployment

### Immediate Actions

1. **Backup Configuration**
   ```bash
   # Backup these files securely
   cp scripts/.mainnet_config.json ~/backups/
   cp target/deploy/vectaiproj-keypair.json ~/backups/
   ```

2. **Document Addresses**
   - Program ID: `ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf`
   - Sale State: (from .mainnet_config.json)
   - VECT Vault: (from .mainnet_config.json)
   - USDC Treasury: (from .mainnet_config.json)

3. **Verify on Explorer**
   - View program: https://explorer.solana.com/address/ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf
   - View sale state
   - View vault balance

### Monitoring Setup

**Set up alerts for:**
- Large purchases (> $10,000)
- Rapid purchase velocity
- Vault balance approaching zero
- Failed transaction spikes
- Unusual claim patterns

**Tools:**
- Helius webhooks (https://helius.xyz)
- Solana Beach API (https://solana.beach)
- Custom monitoring scripts

### Frontend Integration

Use `scripts/.mainnet_config.json` in your frontend:

```typescript
// Example frontend config
const SALE_CONFIG = {
  programId: "ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf",
  saleState: "...", // from .mainnet_config.json
  vectMint: "J7gr5uPExeRmTc6GdVNyXj4zmYdXmYLYFC5TkkDngm4x",
  usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  network: "mainnet-beta",
  cliffDays: 90,
  priceUsdc: 0.2,
};
```

---

## 🛡️ Security Best Practices

### Authority Management

1. **Current State:**
   - Authority: Your deployer wallet
   - Full control over: pause, unpause, update price, end sale, withdraw USDC

2. **Recommended: Transfer to Multi-Sig**
   ```bash
   # Use Squads Protocol or similar
   # 3-of-5 multi-sig reduces rug pull risk
   ```

3. **If Keeping Single Authority:**
   - Use hardware wallet
   - Never expose private key
   - Store in multiple secure locations
   - Set up 2FA on all related accounts

### Emergency Procedures

**If something goes wrong:**

1. **Pause the sale immediately:**
   ```bash
   ts-node scripts/admin_pause.ts
   ```

2. **Investigate the issue**
   - Check transaction logs
   - Review program accounts
   - Identify root cause

3. **Take corrective action:**
   - Fix price: `ts-node scripts/admin_update_price.ts <NEW_PRICE>`
   - Withdraw USDC: `ts-node scripts/admin_withdraw.ts`
   - End sale if necessary: `ts-node scripts/admin_end_sale.ts`

4. **Unpause only when safe:**
   ```bash
   ts-node scripts/admin_unpause.ts
   ```

### Contact Information

- **Solana Support:** https://discord.gg/solana
- **Anchor Support:** https://discord.gg/anchor
- **Security Issues:** Report immediately to team

---

## 📋 Launch Day Checklist

### T-24 Hours
- [ ] All team members briefed
- [ ] Support channels ready (Discord, Twitter)
- [ ] Documentation published
- [ ] Monitoring dashboards active
- [ ] Emergency contacts on standby

### T-1 Hour
- [ ] Final test purchase successful
- [ ] All systems operational
- [ ] Team members online
- [ ] Announcement prepared

### Launch
- [ ] Post announcement
- [ ] Monitor first transactions
- [ ] Respond to user questions
- [ ] Watch for issues

### T+24 Hours
- [ ] Review sale metrics
- [ ] Check for any issues
- [ ] Gather user feedback
- [ ] Adjust support as needed

---

## 📞 Emergency Contacts

- **Solana Status:** https://status.solana.com
- **RPC Issues:** Check multiple RPCs (Helius, QuickNode, Triton)
- **Program Authority:** (Your secure contact method)

---

## ✅ Final Pre-Launch Verification

Before announcing your sale:

- [ ] Program deployed to mainnet
- [ ] Sale initialized with correct parameters
- [ ] Vault funded with VECT tokens
- [ ] Test purchase completed successfully
- [ ] All PDAs verified on explorer
- [ ] Monitoring alerts configured
- [ ] Emergency procedures documented
- [ ] Team ready for launch
- [ ] Frontend (when ready) tested
- [ ] User documentation prepared

---

## 🎉 You're Ready!

Once all checkboxes are complete, your sale is ready to launch.

**Good luck with your token sale!** 🚀

