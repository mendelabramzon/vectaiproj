# VECT Token Vesting Sale

Secure Solana program for selling tokens with linear vesting schedules.

## Features

- **Fixed Price Sales**: USDC-only payments
- **Linear Vesting**: Configurable cliff + vesting period
- **Admin Controls**: Pause/unpause/end sale, update price
- **Security**: CEI pattern, overflow protection, zero dust claims
- **Minimum Purchase**: 10 USDC prevents spam

## Quick Start

**Choose your path:**
- 🧪 **[Testnet](#testnet-fast-testing)** - 10-minute cliff for rapid testing
- 🚀 **[Mainnet](#mainnet-deployment)** - 90-day cliff for production

### Prerequisites

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v2.3.0/install)"

# Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli

# Node.js 25+
nvm install 25 && nvm use 25
```

### Build & Test

```bash
# Install dependencies
yarn install

# Build program
anchor build

# Run tests (localnet)
solana-test-validator    # Terminal 1
anchor test               # Terminal 2
```

## Program Structure

### Instructions (9)

| Instruction | Access | Description |
|------------|--------|-------------|
| `initialize_sale` | Authority | Setup sale parameters |
| `admin_fund_vault` | Authority | Fund with VECT tokens |
| `buy_with_usdc` | Public | Purchase tokens (min 10 USDC) |
| `claim` | Beneficiary | Claim vested tokens |
| `withdraw_usdc` | Authority | Withdraw raised funds |
| `pause_sale` | Authority | Emergency pause |
| `unpause_sale` | Authority | Resume purchases |
| `end_sale` | Authority | Permanently close |
| `update_price` | Authority | Change token price |

### PDAs

```
Sale State:      [b"sale", authority]
VECT Vault:      [b"vect_vault", sale_state]
USDC Treasury:   [b"usdc_treasury", sale_state]
Vesting:         [b"vesting", sale_state, buyer]
```

## Usage

### Testnet (Fast Testing)

**10-minute cliff for rapid iteration:**

```bash
# 1. Configure
solana config set --url devnet
solana airdrop 2

# 2. Deploy
anchor build
anchor deploy --provider.cluster devnet

# 3. Setup
yarn testnet:create-tokens  # Create test VECT + USDC
yarn testnet:init            # Initialize (10-min cliff)
yarn testnet:fund 1000000    # Fund vault

# 4. Test
yarn buy 10                  # Buy tokens
# Wait 10 minutes ⏱️
yarn claim                   # Claim all tokens

# 5. Monitor
yarn testnet:status
```

**See [TESTNET_GUIDE.md](TESTNET_GUIDE.md) for details**

### Mainnet (Production)

**90-day cliff for real deployment:**

```bash
# 1. Configure
solana config set --url mainnet-beta

# 2. Deploy
anchor build
anchor deploy --provider.cluster mainnet  # Costs ~3 SOL

# 3. Setup
yarn mainnet:init            # Initialize (90-day cliff)
yarn mainnet:fund 1000000    # Fund with real VECT

# 4. Launch
yarn mainnet:status          # Monitor

# 5. Admin
yarn admin:pause             # Emergency controls
yarn admin:update-price 150000
```

**See [MAINNET_QUICKSTART.md](MAINNET_QUICKSTART.md) for details**

### 4. Admin Operations

```typescript
// Pause sale
await program.methods.pauseSale()
  .accounts({ saleState, authority })
  .rpc();

// Update price
await program.methods.updatePrice(new anchor.BN(100_000))
  .accounts({ saleState, authority })
  .rpc();

// End sale
await program.methods.endSale()
  .accounts({ saleState, authority })
  .rpc();
```

## Configuration

### Default Parameters

```rust
CLIFF_DURATION = 90 days     // Before vesting starts
VESTING_DURATION = 365 days  // Linear vesting period
PRICE = 0.05 USDC per VECT  // Default price
MIN_PURCHASE = 10 USDC       // Minimum buy amount
```

### Price Calculation

```rust
vect_amount = (usdc_amount × 10^9) / price_per_vect

Example: 10 USDC → 200 VECT (at 0.05 USDC per VECT)
```

### Vesting Schedule

```
Time:  [Purchase] ----[90d Cliff]----[365d Linear Vesting]----[100% Unlocked]
Tokens:    0%              0%         Progressive release         100%
```

## Security

### Implemented
✅ USDC-only (no oracle risk)
✅ Proper decimal handling
✅ CEI pattern (reentrancy protection)
✅ Overflow protection (checked math)
✅ PDA verification
✅ Zero dust (100% claimable)
✅ Parameter validation
✅ Emergency controls

### Recommendations for Production
- Professional security audit
- Multi-sig authority
- Timelock on withdrawals (optional)
- Gradual rollout (devnet → mainnet)

## State Accounts

```rust
SaleState {
    authority: Pubkey,
    vect_mint: Pubkey,
    usdc_mint: Pubkey,
    vect_vault: Pubkey,
    usdc_treasury: Pubkey,
    cliff_duration: i64,
    vesting_duration: i64,
    usdc_price_per_vect: u64,
    total_vect_sold: u64,
    total_usdc_raised: u64,
    is_paused: bool,
    is_ended: bool,
    bump: u8,
}

Vesting {
    beneficiary: Pubkey,
    sale_state: Pubkey,
    total_vect_amount: u64,
    claimed_amount: u64,
    start_time: i64,
    bump: u8,
}
```

## Error Codes

```rust
MathOverflow              // Arithmetic overflow
InvalidAmount             // Zero or invalid amount
InsufficientVaultBalance  // Not enough tokens in vault
CliffNotReached           // Cliff period not passed
NothingToClaim            // No tokens to claim
InvalidCliffDuration      // Invalid cliff parameter
InvalidVestingDuration    // Invalid vesting parameter
InvalidPrice              // Price must be > 0
InvalidMintDecimals       // Wrong token decimals
SaleIsPaused              // Cannot buy when paused
SaleHasEnded              // Cannot buy when ended
SaleAlreadyPaused         // Already paused
SaleNotPaused             // Not paused
SaleAlreadyEnded          // Already ended
BelowMinimumPurchase      // Less than 10 USDC
```

## Deployment

**Quick Guides:**
- 🧪 **[TESTNET_GUIDE.md](TESTNET_GUIDE.md)** - Complete testnet guide (10-min cliff)
- ⚡ **[MAINNET_QUICKSTART.md](MAINNET_QUICKSTART.md)** - Quick mainnet deployment
- 📋 **[MAINNET_CHECKLIST.md](MAINNET_CHECKLIST.md)** - Detailed mainnet checklist
- 📖 **[DEPLOYMENT.md](DEPLOYMENT.md)** - Comprehensive guide (all networks)
- 💻 **[FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md)** - Frontend developer guide
- ⚡ **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - All commands at a glance

## Testing

```bash
# Full test suite
anchor test

# Test coverage:
✓ Initialization
✓ Minimum purchase validation
✓ Purchase flow
✓ Pause/unpause
✓ Price updates
✓ End sale
✓ Claim enforcement
✓ Admin withdrawals
```

### Parity Swap (mock Raydium) tests
- Purpose: parity router picks buy/sell branch based on sum parity, then CPIs into a mock swap program that transfers tokens.
- Commands (local validator on 8899 running):
  ```bash
  # build & deploy mock + router
  anchor build -p mock_swap && anchor deploy -p mock_swap
  anchor build -p parity_swap && anchor deploy -p parity_swap
  # run only parity swap tests
  ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 \
  ANCHOR_WALLET=~/.config/solana/mainnet-deployer.json \
  anchor test --skip-local-validator tests/parity_swap.spec.ts
  ```

### Using the router with a real Raydium pool
- Client builds two Raydium swap instructions (buy/sell) off-chain (e.g., via Raydium/Jupiter SDK).
- Provide to `executeParitySwap(numbers, buy_ix_data, sell_ix_data, buy_accounts_len)`:
  - `buy_ix_data` / `sell_ix_data`: serialized Raydium instructions.
  - `remaining_accounts`: exact metas for buy followed by sell; `buy_accounts_len` splits them.
  - `dex_program`: Raydium AMM/CLMM program ID.
- Example (TypeScript sketch):
  ```ts
  const { ix: buyIx, keys: buyKeys } = buildRaydiumSwapIx(...);  // from SDK/router
  const { ix: sellIx, keys: sellKeys } = buildRaydiumSwapIx(...);
  await parityProgram.methods
    .executeParitySwap([new BN(1), new BN(2)], buyIx.data, sellIx.data, buyKeys.length)
    .accounts({ authority, dexProgram: RAYDIUM_PROGRAM_ID })
    .remainingAccounts([...buyKeys, ...sellKeys])
    .rpc();
  ```
  The on-chain router forwards only the chosen branch; caller signature must be included in the forwarded metas.

## Client Integration

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";

const provider = anchor.AnchorProvider.env();
const program = anchor.workspace.Vectaiproj as Program;

// Derive sale state PDA
const [saleState] = PublicKey.findProgramAddressSync(
  [Buffer.from("sale"), authority.toBuffer()],
  program.programId
);

// Buy tokens
await program.methods
  .buyWithUsdc(new anchor.BN(10_000_000)) // 10 USDC
  .accounts({
    saleState,
    vesting,
    buyer: buyerPublicKey,
    buyerUsdcAccount,
    usdcTreasury,
    vectVault,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

// Claim vested tokens
await program.methods
  .claim()
  .accounts({
    saleState,
    vesting,
    beneficiary: beneficiaryPublicKey,
    vectMint,
    beneficiaryVectAccount,
    vectVault,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

## Project Structure

```
vectaiproj/
├── programs/vectaiproj/src/lib.rs  # Main program (605 lines)
├── tests/vesting_sale.spec.ts      # Tests (587 lines)
├── scripts/                        # Utility scripts
│   ├── create_mints.ts
│   ├── initialize_sale.ts
│   ├── fund_vault.ts
│   ├── buy_tokens.ts
│   └── claim_tokens.ts
├── Anchor.toml                     # Anchor config
└── DEPLOYMENT.md                   # Deployment guide
```

## Tech Stack

- **Anchor**: 0.32.1
- **Solana**: 2.3.0
- **Rust**: Latest stable
- **Node.js**: 25+
- **TypeScript**: 5.7+

## Support

For issues:
1. Check error messages (comprehensive error codes)
2. Review test cases for examples
3. See DEPLOYMENT.md for deployment help

## License

ISC

## Disclaimer

This software is provided as-is. **Thoroughly test and audit before using with real funds.** The authors are not responsible for any losses incurred through use of this program.

---

**Program ID**: `ETe5hWKprkrRVBryrhvPVDPS37ea4U9iZ7p6pv78Kusf`  
**Status**: Production-ready (pending audit)  
**Version**: 1.0.0
