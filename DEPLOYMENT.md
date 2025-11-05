# Deployment Guide - VECT Vesting Sale Program

This guide walks you through deploying the VECT vesting sale program from scratch.

## Pre-Deployment Checklist

- [ ] Solana CLI installed (v2.3.0+)
- [ ] Anchor CLI installed (v0.32.1)
- [ ] Node.js v25+ installed
- [ ] Wallet with sufficient SOL
- [ ] Program ID configured
- [ ] Mints for VECT and USDC ready

## Step-by-Step Deployment

### 1. Environment Setup

```bash
# Clone the repository
cd vectaiproj

# Install dependencies
yarn install

# Set cluster (localnet, devnet, or mainnet)
solana config set --url https://api.devnet.solana.com

# Check wallet balance
solana balance
# Need at least 5 SOL for devnet deployment
```

### 2. Sync Program IDs (Important!)

**This step ensures your program ID matches across all files:**

```bash
# Sync program IDs - this reads the keypair and updates everything
anchor keys sync

# Verify the program ID
solana-keygen pubkey target/deploy/vectaiproj-keypair.json
# Should output: ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf

# Check that lib.rs and Anchor.toml now match this ID
```

**Why this matters:** If you skip this step, Anchor might generate a new keypair on deployment, causing your declared program ID to mismatch the actual deployed address. This leads to confusing errors in your scripts.

### 3. Build the Program

```bash
# Clean previous builds
anchor clean

# Build (after syncing keys!)
anchor build

# Verify build
ls -la target/deploy/vectaiproj.so
ls -la target/idl/vesting_sale.json  # Note: IDL is named after module, not crate
```

Expected output:
- `target/deploy/vectaiproj.so` (program binary)
- `target/idl/vesting_sale.json` (IDL - named after the #[program] module)
- `target/types/vesting_sale.ts` (TypeScript types)
- `target/deploy/vectaiproj-keypair.json` (program keypair)

### 4. Deploy to Localnet (Testing)

#### Terminal 1: Start Validator
```bash
# Start local validator
solana-test-validator --reset

# Or with custom settings
solana-test-validator \
  --reset \
  --ledger test-ledger \
  --rpc-port 8899 \
  --log
```

#### Terminal 2: Deploy
```bash
# Set environment variables for scripts
export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
export ANCHOR_WALLET=~/.config/solana/id.json

# Airdrop SOL
solana airdrop 10

# Deploy
anchor deploy

# Verify deployment (use the actual program ID)
solana program show ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf

# Should show:
# Program Id: ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf
# Owner: BPFLoaderUpgradeab1e11111111111111111111111
# Authority: <your-wallet-address>
```


### 5. Initialize the Sale (Localnet)

```bash
# Make sure environment variables are set
export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
export ANCHOR_WALLET=~/.config/solana/id.json

# Create test mints
yarn create-mints

# Initialize sale with vesting parameters
yarn init-sale

# Fund the vault with VECT tokens
yarn fund-vault
```

Verify:
```bash
# Check vault balance
solana account <VECT_VAULT_ADDRESS>

# The IDL is in your local files (target/idl/vesting_sale.json)
# For on-chain IDL (optional):
anchor idl init -f target/idl/vesting_sale.json ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf
```

### 6. Test the Sale (Localnet)

```bash
# Run automated tests
anchor test

# Or test manually with scripts
yarn buy 10        # Buy 10 USDC worth (200 VECT)
yarn claim         # Claim (will fail before cliff - expected!)

# Check vesting status
cat scripts/.sale_config.json  # See sale configuration
```

### 7. Deploy to Devnet

#### Update Configuration

Edit `Anchor.toml`:
```toml
[programs.devnet]
vectaiproj = "ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

#### Deploy
```bash
# Switch to devnet
solana config set --url devnet

# Update environment variable
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com

# Airdrop SOL (or send from faucet)
solana airdrop 2
solana airdrop 2

# Check balance
solana balance
# Need at least 5 SOL

# Deploy
anchor deploy --provider.cluster devnet

# Verify
solana program show ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf --url devnet
```

### 8. Initialize on Devnet

You'll need actual VECT and USDC mints (not test mints):

```bash
# For devnet, you can use devnet USDC or create test mints
# Devnet USDC: Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr

# Set environment for devnet
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com

# Create mints (or use existing)
yarn create-mints

# Initialize sale
yarn init-sale

# Fund vault with your VECT tokens
yarn fund-vault
```

**Note:** On devnet, you'll need to create real token mints. The test mints script works on devnet too, but you might want to use production-like mints.

### 8. Deploy to Mainnet-Beta

⚠️ **WARNING**: Mainnet deployment is irreversible. Ensure thorough testing.

#### Pre-Mainnet Checklist

- [ ] Full test coverage passing on localnet
- [ ] Deployed and tested on devnet for at least 1 week
- [ ] Security audit completed
- [ ] Code review by multiple developers
- [ ] Multi-sig wallet configured for authority
- [ ] Emergency procedures documented
- [ ] Real VECT and USDC mints ready
- [ ] Sufficient SOL for deployment (10-20 SOL)

#### Mainnet Deployment

```bash
# Switch to mainnet
solana config set --url mainnet-beta

# Verify wallet
solana address
# Ensure this is your production wallet with sufficient SOL

# BACKUP YOUR KEYPAIR
cp ~/.config/solana/id.json ~/backup/id.json.backup

# Build for mainnet
anchor build

# Deploy
anchor deploy --provider.cluster mainnet-beta

# Verify deployment
solana program show ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf --url mainnet-beta
```

#### Initialize on Mainnet

```bash
# Use PRODUCTION mints
export VECT_MINT="<your-vect-mint>"
export USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Initialize with PRODUCTION parameters
ts-node scripts/initialize_sale.ts

# Fund vault with REAL tokens
ts-node scripts/fund_vault.ts 1000000  # 1M VECT
```

## Post-Deployment

### Verification

1. **Program Deployment**
   ```bash
   solana program show <PROGRAM_ID>
   ```

2. **Sale State**
   ```bash
   # Fetch sale state account
   solana account <SALE_STATE_PDA>
   ```

3. **Vault Balance**
   ```bash
   # Check VECT vault has tokens
   spl-token account-info <VECT_VAULT_ADDRESS>
   ```

### Monitoring

Set up monitoring for:
- Program logs: `solana logs <PROGRAM_ID>`
- Vault balances
- Treasury balances
- Sale statistics
- Vesting accounts

### Administration

```bash
# Withdraw USDC (as authority)
anchor run withdraw-usdc -- <amount>

# Withdraw SOL (as authority)
anchor run withdraw-sol -- <amount>

# Fund vault with more tokens
yarn fund-vault <amount>
```

## Upgrade Process

To upgrade the program:

```bash
# 1. Make code changes
# 2. Build new version
anchor build

# 3. Test thoroughly on localnet
anchor test

# 4. Test on devnet
anchor upgrade target/deploy/vectaiproj.so \
  --program-id ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf \
  --provider.cluster devnet

# 5. Upgrade mainnet (requires authority)
anchor upgrade target/deploy/vectaiproj.so \
  --program-id ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf \
  --provider.cluster mainnet-beta
```

⚠️ **Important**: Upgrades should:
- Be backward compatible with existing accounts
- Preserve existing state
- Be tested extensively before mainnet

## Rollback Plan

If issues arise:

1. **Pause Operations** (if pause function implemented)
2. **Stop Frontend** (prevent new transactions)
3. **Investigate** logs and transactions
4. **Fix and Upgrade** or rollback to previous version
5. **Communicate** with users

## Security Best Practices

### Authority Management

```bash
# Use multi-sig for mainnet
# Example with Squads Protocol:
# 1. Create Squads multi-sig
# 2. Transfer program authority to multi-sig
solana program set-upgrade-authority \
  <PROGRAM_ID> \
  --new-upgrade-authority <MULTISIG_ADDRESS>
```

### Monitoring

```bash
# Set up log monitoring
solana logs <PROGRAM_ID> | tee program.log

# Use a service like:
# - Helius webhooks
# - QuickNode functions
# - Custom monitoring script
```

### Rate Limiting

Consider implementing:
- Per-wallet purchase limits
- Time-based cooldowns
- Maximum purchase sizes

## Cost Estimates

### Localnet
- FREE (uses local validator)

### Devnet
- FREE (use faucet for SOL)
- Deployment: ~0 SOL (airdrop)

### Mainnet-Beta
- Program Deployment: ~5-10 SOL
- Account Creation: ~0.01 SOL per account
- Transactions: ~0.000005 SOL per tx

## Troubleshooting

### Program ID Mismatch Issues

**Symptom:** Program deploys to a different address than declared in `lib.rs`

**Example:**
```bash
# lib.rs declares: Erv7pHsGoXbCZG55xXNGuzZR5ruV6BRKfNCteoQkgfm3
# But deploys to: ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf
```

**Root Cause:** The keypair for the declared program ID doesn't exist, so Anchor generates a new one.

**Solution 1: Sync to Existing Keypair (Recommended)**
```bash
# Check what address the keypair generates
solana-keygen pubkey target/deploy/vectaiproj-keypair.json

# Sync everything to match this address
anchor keys sync

# Rebuild
anchor build

# Deploy
anchor deploy

# Now lib.rs, Anchor.toml, and deployed address all match!
```

**Solution 2: Start Fresh**
```bash
# Clear everything
rm -rf target test-ledger scripts/.*.json

# Sync keys before building
anchor keys sync

# Build and deploy
anchor build
anchor deploy
```

**Prevention:** Always run `anchor keys sync` immediately after creating a new Anchor project, before the first build.

### "Failed to find IDL" Error in Scripts

**Symptom:** 
```
Error: Failed to find IDL of program `vectaiproj`
```

**Cause:** The IDL is named `vesting_sale.json` (after the #[program] module name), not `vectaiproj.json`.

**Solution:** Scripts have been updated to load the IDL manually:
```typescript
const idl = JSON.parse(
  fs.readFileSync("target/idl/vesting_sale.json", "utf-8")
);
idl.address = "ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf";
const program = new Program(idl as any, provider);
```

### Environment Variables Not Set

**Symptom:**
```
Error: ANCHOR_PROVIDER_URL is not defined
```

**Solution:**
```bash
# Set required environment variables
export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
export ANCHOR_WALLET=~/.config/solana/id.json

# For permanent setup (zsh)
echo 'export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899' >> ~/.zshrc
echo 'export ANCHOR_WALLET=~/.config/solana/id.json' >> ~/.zshrc
source ~/.zshrc
```

### "Insufficient funds for rent"
```bash
# Need more SOL in deployer wallet
solana balance
solana airdrop 2  # devnet only
```

### "Program already deployed"
```bash
# Use upgrade instead
anchor upgrade target/deploy/vectaiproj.so --program-id ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf
```

### "Invalid authority"
```bash
# Ensure deploying with correct keypair
solana address
# Should match program authority
```

### "Account already in use"
```bash
# PDAs might already exist (on localnet)
solana-test-validator --reset
anchor test
```

## Emergency Procedures

### Freeze Program (if needed)
```bash
# This requires setting upgrade authority to None
# IRREVERSIBLE - program cannot be upgraded after this
solana program set-upgrade-authority <PROGRAM_ID> --final
```

### Withdraw All Funds
```bash
# Emergency withdrawal script
ts-node scripts/emergency_withdraw.ts
```

## Support & Resources

- **Anchor Docs**: https://www.anchor-lang.com/
- **Solana Docs**: https://docs.solana.com/
- **SPL Token**: https://spl.solana.com/token
- **Discord**: Anchor/Solana Discord servers

## Final Checklist

Before going live:
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Multi-sig configured
- [ ] Monitoring set up
- [ ] Emergency procedures documented
- [ ] Team trained on operations
- [ ] User documentation ready
- [ ] Frontend integrated and tested
- [ ] Legal review completed (if applicable)

---

**Remember**: Once on mainnet, transactions are real and irreversible. Test everything thoroughly!

