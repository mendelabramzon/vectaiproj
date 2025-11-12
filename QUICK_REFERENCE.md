# ⚡ Quick Reference

All commands at your fingertips.

---

## 🌐 Network Configuration

```bash
# Localnet
solana config set --url localhost

# Devnet (Testnet)
solana config set --url devnet
solana airdrop 2

# Mainnet
solana config set --url mainnet-beta

# Check current
solana config get
solana balance
```

---

## 🛠️ Build & Deploy

```bash
# Build
anchor build
anchor clean && anchor build  # Clean build

# Deploy
anchor deploy                          # Local
anchor deploy --provider.cluster devnet    # Testnet
anchor deploy --provider.cluster mainnet   # Mainnet

# Verify
solana program show ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf
```

---

## 🧪 Testnet Commands

```bash
# Full flow (10-minute cliff)
yarn testnet:create-tokens    # Create test VECT + USDC
yarn testnet:init             # Initialize sale
yarn testnet:fund 1000000     # Fund vault
yarn testnet:status           # Check status
yarn buy 10                   # Buy tokens
# Wait 10 minutes ⏱️
yarn claim                    # Claim tokens

# Quick reset
anchor clean && anchor build && anchor deploy --provider.cluster devnet
```

---

## 🚀 Mainnet Commands

```bash
# Deployment flow (90-day cliff)
yarn mainnet:init             # Initialize sale
yarn mainnet:fund 1000000     # Fund vault
yarn mainnet:status           # Check status

# Admin
yarn admin:pause              # Emergency pause
yarn admin:unpause            # Resume
yarn admin:update-price 150000   # Update to 0.15 USDC
yarn admin:withdraw 1000      # Withdraw 1000 USDC
```

---

## 📊 Monitoring

```bash
# Sale status
yarn testnet:status           # Testnet
yarn mainnet:status           # Mainnet

# Token balances
spl-token accounts <MINT_ADDRESS>
spl-token balance <MINT_ADDRESS>

# Program info
solana program show <PROGRAM_ID>
```

---

## 🧑‍💻 User Actions

```bash
# Buy tokens
yarn buy 10                   # 10 USDC worth
ts-node scripts/buy_tokens.ts 50

# Claim tokens
yarn claim
ts-node scripts/claim_tokens.ts
```

---

## 🔑 Key Addresses

### Your Token
```
VECT: J7gr5uPExeRmTc6GdVNyXj4zmYdXmYLYFC5TkkDngm4x
Decimals: 6
```

### Official Tokens
```
USDC (Mainnet): EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
USDC Decimals: 6
```

### Program
```
Program ID: ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf
```

---

## 💰 Price Conversion

```
USDC Amount → Contract Value (6 decimals)

0.001 USDC = 1,000
0.01 USDC  = 10,000
0.05 USDC  = 50,000
0.1 USDC   = 100,000
0.15 USDC  = 150,000
0.2 USDC   = 200,000  ← Default
0.5 USDC   = 500,000
1 USDC     = 1,000,000
```

---

## ⏱️ Time Periods

### Testnet
```
Cliff: 10 minutes (600 seconds)
Vesting: 1 second
Total: ~10 minutes to test
```

### Mainnet
```
Cliff: 90 days (7,776,000 seconds)
Vesting: 1 second
Total: ~90 days to unlock
```

---

## 📁 Important Files

```
# Source
programs/vectaiproj/src/lib.rs    # Main program

# Config
Anchor.toml                       # Anchor config
Cargo.toml                        # Rust dependencies

# Scripts
scripts/testnet_*.ts              # Testnet scripts
scripts/*_mainnet.ts              # Mainnet scripts
scripts/admin_*.ts                # Admin scripts

# Generated (git-ignored)
scripts/.testnet_config.json      # Testnet addresses
scripts/.mainnet_config.json      # Mainnet addresses
target/deploy/vectaiproj.so       # Program binary
target/idl/vesting_sale.json      # IDL
```

---

## 🔗 Explorer Links

### Devnet
```
https://explorer.solana.com/address/<ADDRESS>?cluster=devnet
https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet
```

### Mainnet
```
https://explorer.solana.com/address/<ADDRESS>
https://explorer.solana.com/tx/<SIGNATURE>
```

---

## 🐛 Common Errors

| Error | Solution |
|-------|----------|
| "Cliff not reached" | Wait for full cliff period |
| "Below minimum purchase" | Buy at least 10 USDC |
| "Sale is paused" | Unpause or wait for unpause |
| "Insufficient balance" | Check token balance |
| "Account already initialized" | Sale already exists |
| Airdrop failed | Try smaller amount or use faucet |

---

## 📦 NPM Scripts

```json
// Local
"build": "anchor build"
"deploy": "anchor deploy"
"test": "anchor test"

// Testnet
"testnet:create-tokens": "Create test VECT + USDC"
"testnet:init": "Initialize sale (10-min cliff)"
"testnet:fund": "Fund vault"
"testnet:status": "View status"

// Mainnet
"mainnet:init": "Initialize sale (90-day cliff)"
"mainnet:fund": "Fund vault"
"mainnet:status": "View status"

// Admin
"admin:pause": "Emergency pause"
"admin:unpause": "Resume sale"
"admin:update-price": "Change price"
"admin:withdraw": "Withdraw USDC"

// User
"buy": "Buy tokens"
"claim": "Claim vested tokens"
```

---

## 📚 Documentation

- **README.md** - Project overview
- **TESTNET_GUIDE.md** - Complete testnet guide (10-min cliff)
- **MAINNET_QUICKSTART.md** - Quick mainnet deployment
- **MAINNET_CHECKLIST.md** - Detailed mainnet guide
- **DEPLOYMENT.md** - Comprehensive deployment docs
- **FRONTEND_INTEGRATION.md** - Frontend developer guide
- **QUICK_REFERENCE.md** - This file

---

## ⚡ Cheat Sheet

```bash
# Testnet: Full Flow
solana config set --url devnet && \
anchor build && \
anchor deploy --provider.cluster devnet && \
yarn testnet:create-tokens && \
yarn testnet:init && \
yarn testnet:fund 1000000 && \
yarn testnet:status

# Mainnet: Deploy Only
solana config set --url mainnet-beta && \
anchor build && \
anchor deploy --provider.cluster mainnet

# Quick Status Check
yarn testnet:status   # or yarn mainnet:status

# Emergency Pause
yarn admin:pause

# Quick Test (after setup)
yarn buy 10 && echo "Wait 10 minutes..." && sleep 600 && yarn claim
```

---

## 🎯 Testing Checklist

### Testnet
- [ ] Create tokens
- [ ] Deploy program
- [ ] Initialize sale
- [ ] Fund vault
- [ ] Buy tokens
- [ ] Wait 10 minutes
- [ ] Claim tokens
- [ ] Test pause/unpause
- [ ] Test price update
- [ ] Test withdrawal

### Mainnet
- [ ] Build program
- [ ] Deploy (costs ~3 SOL)
- [ ] Initialize with real params
- [ ] Fund with real VECT
- [ ] Small test purchase
- [ ] Monitor closely
- [ ] Launch publicly

---

## 💡 Pro Tips

- **Testnet first**: Always test on devnet before mainnet
- **Small tests**: Start with minimum amounts
- **Check twice**: Verify all parameters before mainnet
- **Monitor actively**: Watch first transactions closely
- **Use explorer**: Verify everything on chain
- **Backup configs**: Save all generated .json files
- **Document changes**: Keep notes of any modifications

---

**Quick Links:**
- Solana Discord: https://discord.gg/solana
- Anchor Docs: https://www.anchor-lang.com
- SPL Token: https://spl.solana.com/token

