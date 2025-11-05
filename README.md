# VECT Token Vesting Sale Program

A production-grade Solana program built with Anchor 0.32.1 for selling VECT tokens with built-in vesting schedules.

## Features

- **Fixed Price Sales**: Sell VECT tokens at a fixed rate (0.05 USDC per VECT)
- **Multiple Payment Methods**: Accept USDC or SOL
- **Vesting Schedule**: 3-month cliff + 12-month linear vesting
- **Secure Token Escrow**: Tokens held in PDA-controlled vault
- **Admin Controls**: Withdraw raised funds, fund vault
- **Automatic Calculations**: Vesting amounts calculated on-chain
- **SPL Token Integration**: Uses anchor-spl for all token operations

## Technical Stack

- **Anchor**: 0.32.1
- **Solana**: 2.3.0
- **Node.js**: v25+
- **TypeScript**: 5.7+
- **Program ID**: `Erv7pHsGoXbCZG55xXNGuzZR5ruV6BRKfNCteoQkgfm3`

## Prerequisites

Before getting started, ensure you have:

1. **Rust & Solana CLI**
   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Install Solana CLI
   sh -c "$(curl -sSfL https://release.solana.com/v2.3.0/install)"
   ```

2. **Anchor CLI**
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli
   ```

3. **Node.js v25+**
   ```bash
   # Using nvm
   nvm install 25
   nvm use 25
   ```

4. **Yarn**
   ```bash
   npm install -g yarn
   ```

## Quick Start

### 1. Clone and Install

```bash
cd vectaiproj
yarn install
```

### 2. Configure Solana

```bash
# Set to localnet
solana config set --url localhost

# Create a new keypair (if needed)
solana-keygen new --outfile ~/.config/solana/id.json

# Start local validator (in a separate terminal)
solana-test-validator
```

### 3. Build the Program

```bash
anchor build
```

This will:
- Compile the Rust program
- Generate IDL (Interface Definition Language)
- Create the program binary at `target/deploy/vectaiproj.so`

### 4. Deploy the Program

```bash
anchor deploy
```

### 5. Run Tests

```bash
anchor test
```

Or run tests with detailed logs:

```bash
anchor test -- --features="test-bpf"
```

## Program Architecture

### PDAs (Program Derived Addresses)

#### 1. SaleState
```
seeds: [b"sale", authority.key()]
```

Stores:
- Token mint addresses (VECT, USDC)
- Vault and treasury addresses
- Vesting parameters (cliff, duration)
- Sale statistics (sold, raised)
- Price configuration

#### 2. VECT Vault
```
seeds: [b"vect_vault", sale_state.key()]
```

Token account that holds VECT tokens to be sold.

#### 3. USDC Treasury
```
seeds: [b"usdc_treasury", sale_state.key()]
```

Token account that receives USDC payments.

#### 4. Vesting Account
```
seeds: [b"vesting", sale_state.key(), beneficiary.key()]
```

Stores:
- Total VECT purchased
- Amount already claimed
- Start time
- Beneficiary address

### Instructions

#### `initialize_sale`
Sets up the sale with vesting parameters and price.

**Parameters:**
- `cliff_duration`: Seconds until vesting starts (default: 90 days)
- `vesting_duration`: Seconds of linear vesting (default: 365 days)
- `usdc_price_per_vect`: Price in USDC (6 decimals, default: 50,000 = 0.05 USDC)

**Accounts:**
- Creates SaleState PDA
- Creates VECT vault PDA
- Creates USDC treasury PDA

#### `admin_fund_vault`
Transfers VECT tokens to the vault for sale.

**Parameters:**
- `amount`: Number of VECT tokens (base units)

**Access:** Authority only

#### `buy_with_usdc`
Purchase VECT tokens with USDC.

**Parameters:**
- `usdc_amount`: Amount of USDC to spend (base units)

**Process:**
1. Transfers USDC from buyer to treasury
2. Creates or updates vesting account
3. Records purchase amount
4. Updates sale statistics

**Conversion:** 1 USDC = 20 VECT (at 0.05 USDC per VECT)

#### `buy_with_sol`
Purchase VECT tokens with SOL.

**Parameters:**
- `sol_amount`: Amount of SOL to spend (lamports)

**Process:**
1. Converts SOL to USDC equivalent (currently uses fixed rate)
2. Transfers SOL to treasury
3. Creates or updates vesting account
4. Updates sale statistics

**Note:** Production version should integrate Pyth oracle for real-time SOL/USD pricing.

#### `claim`
Claims vested tokens according to the schedule.

**Process:**
1. Checks cliff period has passed
2. Calculates vested amount:
   - Before cliff: 0%
   - After cliff, during vesting: Linear proportion
   - After vesting complete: 100%
3. Transfers claimable tokens to beneficiary
4. Updates claimed amount

**Formula:**
```
vested = (total_amount * time_since_cliff) / vesting_duration
claimable = vested - already_claimed
```

#### `withdraw_usdc` / `withdraw_sol`
Admin withdraws raised funds.

**Access:** Authority only

## Usage Guide

### Initial Setup

#### 1. Create Test Mints

```bash
yarn create-mints
```

This creates:
- VECT mint (9 decimals)
- USDC mint (6 decimals)
- Initial token accounts
- Mints initial supply

Saves configuration to `scripts/.mints.json`

#### 2. Initialize Sale

```bash
yarn init-sale
```

Sets up:
- Sale state PDA
- VECT vault
- USDC treasury
- Vesting parameters

Saves configuration to `scripts/.sale_config.json`

#### 3. Fund the Vault

```bash
# Fund with 1,000,000 VECT (default)
yarn fund-vault

# Fund with custom amount
ts-node scripts/fund_vault.ts 500000
```

### Buying Tokens

#### Buy with USDC

```bash
# Buy with 10 USDC (default)
yarn buy

# Buy with custom amount
ts-node scripts/buy_tokens.ts 50

# Buy as different user
ts-node scripts/buy_tokens.ts 25 ~/.config/solana/buyer.json
```

#### Buy with SOL

Use the program's `buy_with_sol` instruction (integrate into your frontend or create custom script).

### Claiming Tokens

```bash
# Claim as current wallet
yarn claim

# Claim as different user
ts-node scripts/claim_tokens.ts ~/.config/solana/buyer.json
```

**Note:** Cannot claim until cliff period (3 months) has passed.

## Testing

### Unit Tests

Run the full test suite:

```bash
anchor test
```

### Test Coverage

The test suite includes:
- ✅ Sale initialization
- ✅ Vault funding
- ✅ USDC purchases
- ✅ SOL purchases
- ✅ Cliff enforcement
- ✅ Admin withdrawals
- ✅ Sale statistics

### Local Testing with Time Manipulation

For testing vesting schedules locally, you can:

1. **Modify vesting parameters** in tests:
   ```typescript
   const CLIFF_DURATION = 60; // 1 minute
   const VESTING_DURATION = 300; // 5 minutes
   ```

2. **Use Solana test validator** with warp:
   ```bash
   # This requires Solana validator manipulation
   # See Anchor documentation for time-travel testing
   ```

## Security Considerations

### ✅ Implemented

- **Checked Math**: All arithmetic uses checked operations with overflow protection
- **PDA Verification**: All PDAs verified with seeds and bumps
- **Authority Checks**: Admin functions require authority signature
- **Token Safety**: All token transfers use SPL Token CPI
- **Account Validation**: Proper account type and ownership checks
- **Vesting Enforcement**: Cannot claim before cliff or more than vested

### 🔒 Recommendations for Production

1. **Oracle Integration**: Replace fixed SOL/USDC rate with Pyth oracle
2. **Circuit Breakers**: Add emergency pause functionality
3. **Rate Limiting**: Implement purchase limits per wallet
4. **Time Locks**: Add time lock for admin withdrawals
5. **Multi-Sig**: Use multi-signature wallet for authority
6. **Auditing**: Get professional smart contract audit before mainnet

## Troubleshooting

### Build Errors

#### Error: "cargo-build-sbf not found"

```bash
# Ensure Solana CLI is properly installed
solana --version

# Reinstall if needed
sh -c "$(curl -sSfL https://release.solana.com/v2.3.0/install)"
```

#### Error: "anchor-lang version mismatch"

```bash
# Clean and rebuild
anchor clean
rm -rf target/
anchor build
```

### Deployment Errors

#### Error: "insufficient funds"

```bash
# Check SOL balance
solana balance

# Airdrop on localnet
solana airdrop 10

# On devnet
solana airdrop 2 --url devnet
```

#### Error: "Program already deployed"

```bash
# Close existing program (localnet only)
solana program close <PROGRAM_ID>

# Or upgrade instead of deploying
anchor upgrade target/deploy/vectaiproj.so --program-id <PROGRAM_ID>
```

### Test Errors

#### Error: "Account does not exist"

```bash
# Restart validator
pkill solana-test-validator
solana-test-validator --reset

# Run tests again
anchor test
```

#### Error: "Transaction simulation failed"

- Check program logs: `solana logs`
- Verify account balances
- Ensure mints are created
- Check PDAs are correctly derived

### Runtime Errors

#### Error: "CliffNotReached"

- Wait for cliff period (3 months by default)
- For testing, use shorter cliff durations
- Check vesting start time: view the vesting account

#### Error: "InsufficientVaultBalance"

- Vault needs more VECT tokens
- Run: `yarn fund-vault`
- Check vault balance: query the vault account

#### Error: "NothingToClaim"

- All vested tokens already claimed
- Wait for more tokens to vest
- Check vesting schedule calculation

## Development

### File Structure

```
vectaiproj/
├── programs/
│   └── vectaiproj/
│       ├── src/
│       │   └── lib.rs          # Main program code
│       ├── Cargo.toml           # Rust dependencies
│       └── Xargo.toml           # Cross-compilation config
├── tests/
│   └── vesting_sale.spec.ts    # Integration tests
├── scripts/
│   ├── create_mints.ts         # Create test tokens
│   ├── initialize_sale.ts      # Setup sale
│   ├── fund_vault.ts           # Fund with VECT
│   ├── buy_tokens.ts           # Purchase tokens
│   └── claim_tokens.ts         # Claim vested tokens
├── target/
│   ├── deploy/                 # Compiled program
│   ├── idl/                    # Generated IDL
│   └── types/                  # TypeScript types
├── Anchor.toml                 # Anchor configuration
├── Cargo.toml                  # Workspace config
├── package.json                # Node dependencies
└── README.md                   # This file
```

### Adding New Features

1. **Modify Program** (`programs/vectaiproj/src/lib.rs`)
   - Add new instructions
   - Update state structures
   - Add error codes

2. **Rebuild**
   ```bash
   anchor build
   ```

3. **Update Tests** (`tests/vesting_sale.spec.ts`)
   - Add test cases
   - Verify behavior

4. **Run Tests**
   ```bash
   anchor test
   ```

### Upgrading

To upgrade the program on-chain:

```bash
# Build new version
anchor build

# Upgrade (requires authority keypair)
anchor upgrade target/deploy/vectaiproj.so --program-id Erv7pHsGoXbCZG55xXNGuzZR5ruV6BRKfNCteoQkgfm3
```

## API Reference

### Client Integration

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";

// Initialize
const provider = anchor.AnchorProvider.env();
const program = anchor.workspace.Vectaiproj as Program;

// Derive PDAs
const [saleState] = PublicKey.findProgramAddressSync(
  [Buffer.from("sale"), authority.toBuffer()],
  program.programId
);

// Buy tokens
await program.methods
  .buyWithUsdc(new anchor.BN(amount))
  .accounts({
    saleState,
    vesting,
    buyer: buyerPublicKey,
    // ... other accounts
  })
  .rpc();
```

### Query Sale Info

```typescript
// Fetch sale state
const saleState = await program.account.saleState.fetch(saleStatePDA);
console.log("Total sold:", saleState.totalVectSold);
console.log("USDC raised:", saleState.totalUsdcRaised);

// Fetch vesting info
const vesting = await program.account.vesting.fetch(vestingPDA);
console.log("Total amount:", vesting.totalVectAmount);
console.log("Claimed:", vesting.claimedAmount);
```

## Deployment to Devnet/Mainnet

### 1. Update Anchor.toml

```toml
[programs.devnet]
vectaiproj = "Erv7pHsGoXbCZG55xXNGuzZR5ruV6BRKfNCteoQkgfm3"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

### 2. Configure Solana CLI

```bash
solana config set --url devnet
```

### 3. Fund Wallet

```bash
# Get SOL for deployment
solana airdrop 2

# Or fund from exchange
```

### 4. Deploy

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### 5. Verify

```bash
solana program show <PROGRAM_ID>
```

## License

ISC

## Support

For issues and questions:
- Check troubleshooting section above
- Review test cases in `tests/vesting_sale.spec.ts`
- Examine program code in `programs/vectaiproj/src/lib.rs`

## Disclaimer

This software is provided as-is. Thoroughly test and audit before using with real funds. The authors are not responsible for any losses incurred through use of this program.

