# Deployment Guide

Complete deployment instructions for localnet, devnet, and mainnet.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Local Deployment](#local-deployment)
3. [Devnet Deployment](#devnet-deployment)
4. [Mainnet Deployment](#mainnet-deployment)
5. [Testing Guide](#testing-guide)
6. [Post-Deployment](#post-deployment)
7. [Emergency Procedures](#emergency-procedures)

---

## Pre-Deployment Checklist

### Code Verification
- [ ] `anchor build` completes successfully
- [ ] All tests pass (`anchor test`)
- [ ] No critical linter warnings
- [ ] Security audit completed (mainnet only)
- [ ] Multi-sig setup ready (mainnet recommended)

### Configuration
- [ ] Token mints prepared (VECT, USDC)
- [ ] Sale parameters decided (cliff, vesting, price)
- [ ] Authority wallet funded
- [ ] Backup of all keypairs

### Dependencies
```bash
# Verify versions
anchor --version    # Should be 0.32.1
solana --version    # Should be 2.3.0+
node --version      # Should be 25+
```

---

## Local Deployment

### 1. Start Local Validator

```bash
# Terminal 1: Start validator
solana-test-validator --reset
```

### 2. Configure Solana CLI

```bash
# Terminal 2: Set to localhost
solana config set --url localhost

# Verify connection
solana cluster-version

# Check balance
solana balance

# Airdrop if needed
solana airdrop 10
```

### 3. Build & Deploy

```bash
# Build program
anchor build

# Deploy
anchor deploy

# Verify deployment
solana program show <PROGRAM_ID>
```

### 4. Create Test Mints

```bash
# Creates VECT and USDC test mints
yarn create-mints
# Saves to: scripts/.mints.json
```

**Output**:
```json
{
  "vectMint": "...",
  "usdcMint": "...",
  "authorityVectAccount": "...",
  "authorityUsdcAccount": "..."
}
```

### 5. Initialize Sale

```bash
yarn init-sale
# Saves to: scripts/.sale_config.json
```

**Default Parameters**:
- Cliff: 90 days
- Vesting: 365 days  
- Price: 0.05 USDC per VECT

### 6. Fund Vault

```bash
# Fund with 1M VECT (default)
yarn fund-vault

# Or custom amount
ts-node scripts/fund_vault.ts 500000
```

### 7. Test Purchase

```bash
# Buy 10 USDC worth (minimum)
yarn buy 10

# Check vesting account
solana account <VESTING_PDA>
```

### 8. Run Full Test Suite

```bash
# In separate terminal with validator running
anchor test --skip-deploy
```

---

## Devnet Deployment

### 1. Configure for Devnet

```bash
# Set cluster
solana config set --url devnet

# Verify
solana config get
```

### 2. Fund Authority Wallet

```bash
# Check balance
solana balance

# Airdrop (2 SOL max per request)
solana airdrop 2

# May need multiple airdrops
solana airdrop 2
```

**Note**: Devnet airdrops are rate-limited. Alternative: Use a devnet faucet.

### 3. Update Program ID (If Needed)

If deploying to a new address:

```bash
# Generate new keypair
solana-keygen new -o target/deploy/vectaiproj-keypair.json

# Update Anchor.toml
[programs.devnet]
vectaiproj = "NEW_PROGRAM_ID"

# Update lib.rs
declare_id!("NEW_PROGRAM_ID");

# Rebuild
anchor build
```

### 4. Deploy to Devnet

```bash
# Deploy
anchor deploy --provider.cluster devnet

# Verify
solana program show <PROGRAM_ID> --url devnet
```

### 5. Create Real Token Mints

**Option A: Use existing USDC devnet mint**
```
USDC Devnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

**Option B: Create your own**
```bash
# Create VECT mint
spl-token create-token --decimals 9

# Create USDC test mint
spl-token create-token --decimals 6

# Update scripts/.mints.json with addresses
```

### 6. Initialize & Test

```bash
# Initialize sale
yarn init-sale

# Fund vault
yarn fund-vault

# Test purchase
yarn buy 10

# Verify on Solana Explorer
# https://explorer.solana.com/?cluster=devnet
```

### 7. Integration Testing

Test all functionality:
- [ ] Purchase tokens
- [ ] Pause/unpause sale
- [ ] Update price
- [ ] Withdraw USDC
- [ ] End sale
- [ ] Claim (after cliff, need to wait or modify cliff duration)

---

## Mainnet Deployment


### 2. Multi-Sig Setup

**Strongly Recommended**: Use Squads Protocol or similar

```bash
# Install Squads CLI
npm install -g @sqds/cli

# Create 3-of-5 multi-sig
sqds create-multisig \
  --threshold 3 \
  --members member1.json,member2.json,member3.json,member4.json,member5.json
```

**Benefits**:
- No single point of failure
- Requires multiple approvals for critical actions
- Reduces rug pull risk
- Better compliance

### 3. Prepare Mainnet Wallet

```bash
# Create new keypair (SECURE)
solana-keygen new -o ~/.config/solana/mainnet-authority.json

# CRITICAL: Backup this keypair securely
# - Encrypted cloud storage
# - Hardware wallet
# - Physical backup in safe

# Fund with SOL (for deployment)
# Send ~5-10 SOL for deployment + operations
```

### 4. Token Preparation

#### VECT Token
```bash
# If not already created, create VECT token
spl-token create-token --decimals 9

# Set up token metadata (recommended)
# Use Metaplex Token Metadata
```

#### USDC Setup
```
USDC Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
(Use official USDC address **ALWAYS CHECK IT!**)
```

### 5. Configure for Mainnet

```bash
# Set to mainnet-beta
solana config set --url mainnet-beta
solana config set --keypair ~/.config/solana/mainnet-authority.json

# Verify (CRITICAL)
solana config get
```

**Double-check output**:
```
RPC URL: https://api.mainnet-beta.solana.com
WebSocket URL: wss://api.mainnet-beta.solana.com
Keypair Path: /home/user/.config/solana/mainnet-authority.json
```

### 6. Program Deployment Costs

**Estimate**:
- Program deployment: ~5 SOL
- Account rent: ~0.05 SOL per account
- Transaction fees: ~0.000005 SOL each

**Total for initial setup**: ~6-8 SOL

### 7. Deploy to Mainnet

```bash
# Final verification
anchor build

# Check program size
ls -lh target/deploy/vectaiproj.so

# Deploy (THIS IS PERMANENT)
anchor deploy --provider.cluster mainnet-beta

# Save program ID
PROGRAM_ID=$(solana address -k target/deploy/vectaiproj-keypair.json)
echo "Program ID: $PROGRAM_ID"
```

### 8. Verify Deployment

```bash
# Check program
solana program show $PROGRAM_ID --url mainnet-beta

# Verify on explorer
# https://explorer.solana.com/address/<PROGRAM_ID>

# Check program account
solana account $PROGRAM_ID --url mainnet-beta
```

### 9. Initialize Sale (Mainnet)

**CRITICAL: Review parameters carefully**

```typescript
// scripts/initialize_sale_mainnet.ts
const CLIFF_DURATION = 90 * 24 * 60 * 60;      // 90 days
const VESTING_DURATION = 365 * 24 * 60 * 60;   // 365 days
const USDC_PRICE_PER_VECT = 50_000;             // 0.05 USDC

// VERIFY THESE VALUES MULTIPLE TIMES
console.log("Cliff:", CLIFF_DURATION / 86400, "days");
console.log("Vesting:", VESTING_DURATION / 86400, "days");
console.log("Price:", USDC_PRICE_PER_VECT / 1_000_000, "USDC per VECT");

// Confirm with team before executing
const confirmed = await getTeamConfirmation();
if (!confirmed) throw new Error("Deployment cancelled");

await program.methods
  .initializeSale(
    new anchor.BN(CLIFF_DURATION),
    new anchor.BN(VESTING_DURATION),
    new anchor.BN(USDC_PRICE_PER_VECT)
  )
  .accounts({ /* ... */ })
  .rpc();
```

### 10. Fund Vault (Mainnet)

```bash
# Calculate exact amount needed
TOTAL_SALE_AMOUNT=1000000  # 1M VECT tokens

# Transfer VECT to authority
spl-token transfer <VECT_MINT> <AMOUNT> <AUTHORITY_VECT_ACCOUNT>

# Fund vault
ts-node scripts/fund_vault.ts $TOTAL_SALE_AMOUNT

# Verify vault balance
spl-token accounts <VECT_MINT>
```

### 11. Pre-Launch Checklist

**Before allowing public access**:

- [ ] Program deployed and verified
- [ ] Sale initialized with correct parameters
- [ ] Vault funded with tokens
- [ ] Authority transferred to multi-sig (if using)
- [ ] Monitoring dashboard active
- [ ] Emergency contacts notified
- [ ] Documentation published
- [ ] Support channels ready
- [ ] Team on standby for launch

### 12. Soft Launch (Recommended)

```bash
# Start paused
ts-node scripts/admin_pause.ts

# Allow small group to test
# Monitor for 24-48 hours

# If all good, unpause
ts-node scripts/admin_unpause.ts
```

### 13. Monitoring

**Set up alerts for**:
- Large purchases (> $10k)
- Rapid purchase velocity
- Failed transactions spike
- Vault balance low
- Unexpected program calls

**Tools**:
- Helius webhooks
- Solana Beach API
- Custom monitoring scripts

### 14. Transfer to Multi-Sig (Recommended)

```bash
# After testing, transfer authority
# This is ONE-WAY - cannot be undone easily

ts-node scripts/transfer_authority.ts --new-authority <MULTISIG_ADDRESS>
```

---

## Testing Guide

### Test Structure

The test suite (`tests/vesting_sale.spec.ts`) contains **14 comprehensive tests**:

#### Initialization Tests (2)
```typescript
1. "Initialize sale"
   - Creates sale state PDA
   - Verifies all parameters
   - Checks is_paused=false, is_ended=false

2. "Fund vault with VECT tokens"
   - Mints VECT to authority
   - Transfers to vault
   - Verifies vault balance
```

#### Purchase Tests (3)
```typescript
3. "Cannot buy with less than minimum (10 USDC)"
   - Tests minimum purchase validation
   - Expects BelowMinimumPurchase error

4. "Buy VECT with USDC"
   - First buyer purchases tokens
   - Verifies vesting account created
   - Checks USDC transferred to treasury
   - Validates token amount calculation

5. "Second buyer purchases VECT"
   - Different buyer purchases
   - Verifies separate vesting account
   - Tests concurrent purchases
```

#### Lifecycle Tests (5)
```typescript
6. "Admin can pause the sale"
   - Authority pauses sale
   - Verifies is_paused=true

7. "Cannot buy when paused"
   - Tests paused state enforcement
   - Expects SaleIsPaused error

8. "Admin can unpause the sale"
   - Authority resumes sale
   - Verifies is_paused=false

9. "Admin can update price"
   - Updates token price
   - Verifies new price applied
   - Resets to original price

10. "Admin can end the sale"
    - Authority ends sale permanently
    - Verifies is_ended=true
    - Checks is_paused cleared
```

#### Claim Tests (1)
```typescript
11. "Cannot claim before cliff"
    - Tests cliff enforcement
    - Expects CliffNotReached error
```

#### Admin Tests (1)
```typescript
12. "Admin withdraws USDC"
    - Withdraws half of treasury
    - Verifies authority receives USDC
    - Checks treasury balance reduced
```

#### End State Tests (2)
```typescript
13. "Cannot buy when sale has ended"
    - Tests ended state enforcement
    - Expects SaleHasEnded error

14. "Fetch and display sale statistics"
    - Reads final sale state
    - Displays total sold, raised
    - Verifies data consistency

15. "Display vesting schedule info"
    - Shows vesting parameters
    - Educational output
```

### Running Tests

#### Full Test Suite
```bash
# Start validator
solana-test-validator --reset

# Run all tests
anchor test --skip-deploy

# Expected output: ✓ 14 passing
```

#### Individual Test
```bash
# Run specific test
anchor test --skip-deploy -- --grep "Cannot buy when paused"
```

#### Test Coverage
```bash
# With coverage report
anchor test --skip-deploy -- --coverage
```

### Test Data

**Test Accounts**:
- Authority: Provider wallet
- Buyer 1: Random keypair (10 USDC purchase)
- Buyer 2: Random keypair (50 USDC purchase)
- VECT Mint: 9 decimals
- USDC Mint: 6 decimals

**Expected Results**:
- Buyer 1: 200 VECT (10 USDC ÷ 0.05)
- Buyer 2: 1000 VECT (50 USDC ÷ 0.05)
- Treasury: 60 USDC total
- Vault: 999,800 VECT remaining (of 1M)

### Manual Testing Checklist

After automated tests, manually verify:

- [ ] Purchase with exact minimum (10 USDC)
- [ ] Purchase with large amount (>100 USDC)
- [ ] Multiple purchases from same wallet
- [ ] Price updates affect new purchases
- [ ] Cannot claim during cliff
- [ ] Can claim after cliff (need modified cliff or wait)
- [ ] Partial claims work correctly
- [ ] Final claim gets 100% (no dust)
- [ ] Cannot buy when paused
- [ ] Cannot buy after ended
- [ ] Admin withdrawal works
- [ ] Non-admin cannot call admin functions

---

## Post-Deployment

### 1. Verification

```bash
# Check program
solana program show <PROGRAM_ID>

# Check sale state
solana account <SALE_STATE_PDA>

# Check vault balance
spl-token balance <VECT_MINT> <VAULT_ADDRESS>
```

### 2. Documentation

**Publish**:
- Program ID
- Sale state PDA address
- Token mint addresses
- Sale parameters
- Important dates (start, cliff end, vesting end)
- Instructions for buyers

### 3. Frontend Integration

```typescript
// Connect to program
const programId = new PublicKey("YOUR_PROGRAM_ID");
const idl = await Program.fetchIdl(programId, provider);
const program = new Program(idl, programId, provider);

// Derive sale state
const [saleState] = PublicKey.findProgramAddressSync(
  [Buffer.from("sale"), authority.toBuffer()],
  programId
);

// Fetch sale info
const saleInfo = await program.account.saleState.fetch(saleState);
console.log("Price:", saleInfo.usdcPricePerVect.toString());
console.log("Total sold:", saleInfo.totalVectSold.toString());
```

### 4. User Guide

**For Buyers**:
1. Connect wallet (Phantom, Solflare, etc.)
2. Ensure 10+ USDC in wallet
3. Click "Buy VECT"
4. Approve transaction
5. Receive confirmation
6. Tokens vest over time
7. Claim after cliff period

### 5. Monitoring Dashboard

**Track**:
- Total VECT sold
- Total USDC raised
- Number of buyers
- Average purchase size
- Vault balance
- Sale status (active/paused/ended)

### 6. Regular Maintenance

**Weekly**:
- Check vault balance
- Monitor for unusual activity
- Review error logs
- Test claim functionality

**Monthly**:
- Financial reconciliation
- Update documentation
- Review and respond to issues

---

## Emergency Procedures

### Pause Sale Immediately

```bash
# If something goes wrong
ts-node scripts/admin_pause.ts

# Verify
solana account <SALE_STATE_PDA> | grep is_paused
```

**When to pause**:
- Security vulnerability discovered
- Pricing error detected
- Unusual activity
- Legal/compliance issue
- Technical problems

### End Sale Permanently

```bash
# Cannot be undone!
ts-node scripts/admin_end_sale.ts
```

**When to end**:
- Sale target reached
- Time limit reached
- Unrecoverable issue
- Business decision

### Withdraw Funds Emergency

```bash
# Withdraw all USDC
TREASURY_BALANCE=$(spl-token balance <USDC_MINT> <TREASURY>)
ts-node scripts/withdraw_usdc.ts $TREASURY_BALANCE
```

### Communication Template

```
EMERGENCY NOTICE

Issue: [Brief description]
Status: Sale PAUSED
Action Required: [For users]
Timeline: [Expected resolution]
Next Update: [Timeframe]

Contact: [Email/Discord/Telegram]
```

### Post-Incident

1. Document what happened
2. Analyze root cause
3. Implement fixes
4. Update procedures
5. Communicate resolution
6. Resume operations carefully

---

## Common Issues

### Deployment Failed
```bash
# Check SOL balance
solana balance

# Check program size (max 10MB)
ls -lh target/deploy/*.so

# Verify network
solana config get
```

### Transaction Failed
```bash
# Check recent logs
solana logs

# Increase compute budget (if needed)
# Add to transaction:
ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 })
```

### Account Not Found
```bash
# Verify PDA derivation
# Check correct seeds and program ID
solana account <PDA_ADDRESS>
```

### Insufficient Funds
```bash
# Buyer needs:
# - 10+ USDC (minimum purchase)
# - ~0.01 SOL (transaction fees + rent)

# Check balances
spl-token balance <USDC_MINT>
solana balance
```

---

## Cost Breakdown

### Localnet
- **Cost**: Free
- **Purpose**: Development, testing

### Devnet
- **Cost**: Free (airdrops)
- **Purpose**: Integration testing, staging

### Mainnet
- **Deployment**: ~5 SOL
- **Account Rent**: ~0.05 SOL per account
- **Transactions**: ~0.000005 SOL each
- **Monitoring**: Variable (service dependent)
- **Audit**: $15k-$50k (one-time)

**Total Initial**: ~6 SOL + audit costs

---

## Upgrade Path

If you need to upgrade the program:

```bash
# Build new version
anchor build

# Upgrade (requires original authority)
solana program deploy target/deploy/vectaiproj.so \
  --program-id <PROGRAM_ID> \
  --upgrade-authority ~/.config/solana/authority.json

# Verify upgrade
solana program show <PROGRAM_ID>
```

**Note**: Account structures cannot change. Plan migrations carefully.

---

## Checklist Summary

### Localnet ✓
- [ ] Validator running
- [ ] Program deployed
- [ ] Mints created
- [ ] Sale initialized
- [ ] Tests passing

### Devnet ✓
- [ ] Program deployed
- [ ] Real/test mints ready
- [ ] Sale initialized
- [ ] Integration tested
- [ ] 2+ weeks of testing

### Mainnet ✓
- [ ] Security audit complete
- [ ] Multi-sig set up
- [ ] Wallet backed up
- [ ] Program deployed
- [ ] Sale initialized
- [ ] Vault funded
- [ ] Monitoring active
- [ ] Team ready
- [ ] Documentation published

---

## Support & Resources

- **Solana Docs**: https://docs.solana.com
- **Anchor Docs**: https://www.anchor-lang.com
- **Solana Explorer**: https://explorer.solana.com
- **Status Page**: https://status.solana.com

---

**Last Updated**: November 2025  
**Program Version**: 1.0.0  
**Anchor Version**: 0.32.1
