# ⚡ Quick Start Guide - VECT Vesting Sale

Get up and running in 5 minutes!

## Prerequisites

- Node.js v25+
- Rust
- Solana CLI (v2.3.0)
- Anchor CLI (v0.32.1)

## 1. Install Dependencies

```bash
yarn install
```

## 2. Build the Program

```bash
anchor build
```

Expected output: `✅ Build successful`

## 3. Start Local Validator

In a **separate terminal**:

```bash
solana-test-validator
```

Keep this running.

## 4. Run Tests

```bash
anchor test --skip-local-validator
```

This will:
- Create test mints (VECT & USDC)
- Initialize the sale
- Fund the vault
- Test purchases with USDC
- Test purchases with SOL
- Verify vesting logic
- Test admin withdrawals

Expected: **All tests pass ✅**

## 5. Manual Usage (Optional)

### Create Mints
```bash
yarn create-mints
```

Creates VECT and USDC test tokens, saves config to `scripts/.mints.json`

### Initialize Sale
```bash
yarn init-sale
```

Sets up:
- Sale state PDA
- VECT vault
- USDC treasury
- Vesting parameters (3-month cliff, 12-month vesting)

### Fund Vault
```bash
# Fund with 1M VECT
yarn fund-vault

# Or custom amount
ts-node scripts/fund_vault.ts 500000
```

### Buy Tokens
```bash
# Buy with 10 USDC
yarn buy

# Or custom amount
ts-node scripts/buy_tokens.ts 25
```

### Claim Tokens
```bash
yarn claim
```

**Note**: Will fail before cliff period. Modify vesting durations in test mode or wait 3 months in production.

## 🎯 Quick Commands

```bash
# Build
anchor build

# Test everything
anchor test

# Deploy locally
anchor deploy

# Check program
solana program show Erv7pHsGoXbCZG55xXNGuzZR5ruV6BRKfNCteoQkgfm3
```

## 📊 Verify Deployment

```bash
# Check program exists
solana account Erv7pHsGoXbCZG55xXNGuzZR5ruV6BRKfNCteoQkgfm3

# View logs
solana logs Erv7pHsGoXbCZG55xXNGuzZR5ruV6BRKfNCteoQkgfm3
```

## 🔍 What's Happening?

1. **Sale Initialization**: Creates PDA accounts for sale state, vault, and treasury
2. **Funding**: Authority transfers VECT tokens to program-controlled vault
3. **Purchasing**: Users send USDC/SOL, receive vesting schedule
4. **Vesting**: Tokens locked for 3 months (cliff), then unlock linearly over 12 months
5. **Claiming**: Users claim unlocked tokens at any time after cliff

## 💰 Economics

- **Price**: 0.05 USDC per VECT
- **Conversion**: 1 USDC = 20 VECT
- **Cliff**: 3 months (no claims)
- **Vesting**: 12 months (linear unlock)
- **Total**: 15 months from purchase to fully vested

## 🎨 Example Flow

```typescript
// 1. User buys 1000 VECT for 50 USDC
buyWithUsdc(50 USDC)
// Vesting account created: 1000 VECT, start_time = now

// 2. Wait 3 months (cliff period)
// claim() → ERROR: CliffNotReached

// 3. After 3 months
claim() → Transfer 0 VECT (cliff just reached)

// 4. After 9 months (6 months into vesting = 50%)
claim() → Transfer 500 VECT (50% of 1000)

// 5. After 15 months (fully vested)
claim() → Transfer 500 VECT (remaining 50%)
```

## 🐛 Troubleshooting

### Build fails
```bash
anchor clean
anchor build
```

### Tests fail
```bash
# Restart validator
pkill solana-test-validator
solana-test-validator --reset

# Run tests
anchor test --skip-local-validator
```

### Insufficient funds
```bash
solana airdrop 10
```

### Program not found
```bash
anchor deploy
```

## 📚 Next Steps

- **Read** `README.md` for full documentation
- **Review** `DEPLOYMENT.md` for production deployment
- **Check** `PROJECT_SUMMARY.md` for architecture details
- **Explore** `tests/vesting_sale.spec.ts` for usage examples
- **Examine** `scripts/` for client integration patterns

## 🎓 Key Files

- `programs/vectaiproj/src/lib.rs` - Main program logic
- `tests/vesting_sale.spec.ts` - Integration tests
- `scripts/*.ts` - Utility scripts
- `target/idl/vesting_sale.json` - Program IDL
- `target/types/vesting_sale.ts` - TypeScript types

## ✅ Success Indicators

You'll know everything works when:

1. ✅ `anchor build` completes without errors
2. ✅ `anchor test` shows all tests passing
3. ✅ You can see the program with `solana program show <PROGRAM_ID>`
4. ✅ Scripts create accounts and execute transactions
5. ✅ Token balances change correctly after operations

## 🚀 Production Checklist

Before going live:

- [ ] Security audit completed
- [ ] Tested thoroughly on devnet
- [ ] Multi-sig wallet configured for authority
- [ ] Pyth oracle integrated for SOL pricing
- [ ] Emergency procedures documented
- [ ] Frontend integrated and tested
- [ ] Monitoring and alerts set up
- [ ] Legal review completed

## 💡 Tips

- **Use devnet** for testing with "real" conditions
- **Modify vesting durations** in tests for faster testing
- **Monitor logs** with `solana logs <PROGRAM_ID>`
- **Check balances** before and after operations
- **Save configurations** from scripts for later use

## 📞 Getting Help

1. Check error messages in terminal
2. Review `README.md` troubleshooting section
3. Examine test file for correct usage
4. Verify account addresses are correct
5. Ensure sufficient SOL for rent and fees

---

**Happy Coding! 🎉**

For detailed information, see `README.md`

