# packages/omaha-programs-sdk - CLAUDE.md

> **OUTDATED**: This SDK covers the original 13 vault instructions. The on-chain program now has 26 instructions (factory management, vault admin transfer, pause, cancel deposit/withdraw). VaultState is 584 bytes (was 520), PendingDeposit/PendingWithdraw are 88 bytes (was 80), and FactoryState (400 bytes) is new. `owners` → `operators` rename. `CollectFees` no longer takes a timestamp parameter (uses Clock sysvar). See `apps/programs/vault/CLAUDE.md` for the current program architecture. This SDK needs updating.

## Overview

This package contains a **fully-typed TypeScript SDK for building Solana TransactionInstruction objects** for the vault program instructions. It provides instruction builders, PDA derivation helpers, state deserializers, fee math utilities, and error codes — enabling type-safe on-chain transaction construction without requiring the Anchor IDL.

## Technology Stack

- **Solana**: @solana/web3.js ^1.98.0, @solana/spl-token ^0.4.12
- **Build Tool**: tsup
- **TypeScript**: 5.7.x (strict mode)
- **Testing**: Vitest (56 tests across 4 test files)
- **Output**: ESM only

## Directory Structure

```
packages/omaha-programs-sdk/
├── src/
│   ├── index.ts                # Main export file
│   ├── instructions/
│   │   ├── index.ts           # Instruction exports
│   │   ├── initialize.ts       # InitializeVault instruction (7 accounts, requires program_authority co-signer)
│   │   ├── deposit-with-price.ts
│   │   ├── request-deposit.ts
│   │   ├── fulfill-deposit.ts
│   │   ├── withdraw-with-price.ts
│   │   ├── request-withdraw.ts
│   │   ├── fulfill-withdraw.ts
│   │   ├── execute.ts          # Execute rebalancing trades
│   │   ├── set-share-price.ts
│   │   ├── collect-fees.ts
│   │   ├── update-fees.ts
│   │   ├── add-owner.ts        # Multi-sig owner management
│   │   └── remove-owner.ts
│   ├── pda.ts                  # PDA derivation helpers
│   ├── state/
│   │   ├── vault-state.ts      # Vault state deserialization
│   │   ├── pending-deposit.ts
│   │   └── pending-withdraw.ts
│   ├── utils.ts                # Fee math and utilities
│   ├── errors.ts               # Program error codes
│   ├── types.ts                # TypeScript interfaces
│   └── constants.ts            # Magic numbers, discriminators
├── __tests__/
│   ├── instructions.test.ts    # Instruction builder tests
│   ├── pda.test.ts            # PDA derivation tests
│   ├── state.test.ts          # State deserialization tests
│   └── utils.test.ts          # Utility function tests
├── dist/                       # Built output (generated)
├── tsconfig.json              # TypeScript config (extends @repo/config-typescript/node.json)
├── tsup.config.ts             # Build configuration
├── eslint.config.js           # ESLint config (uses @repo/config-eslint/base)
└── package.json
```

## Development

```bash
# Build the package
pnpm --filter @repo/omaha-programs-sdk build

# Watch mode for development
pnpm --filter @repo/omaha-programs-sdk dev

# Type check
pnpm --filter @repo/omaha-programs-sdk typecheck

# Run tests (56 tests across 4 files)
pnpm --filter @repo/omaha-programs-sdk test

# Lint
pnpm --filter @repo/omaha-programs-sdk lint

# Clean build artifacts
pnpm --filter @repo/omaha-programs-sdk clean
```

## Key Features

### Constants

- `VAULT_PROGRAM_ID` — on-chain program address
- `PROGRAM_AUTHORITY` — pubkey that must co-sign `Initialize` (restricts vault creation to the program operator)
- `DISC_*` — instruction discriminators (0x00–0x0C)
- `*_DISCRIMINATOR` — account type guards (0xA1–0xA3)
- Fee constants: `BPS_DENOMINATOR`, `SECONDS_PER_YEAR`, `MAX_*_FEE_BPS`

### 13 Instruction Builders

Each instruction has its own builder function that constructs a properly-formed `TransactionInstruction`:

```typescript
// Initialization
initializeVault(config: InitializeVaultConfig) => TransactionInstruction

// Deposit flow
depositWithPrice(config: DepositWithPriceConfig) => TransactionInstruction
requestDeposit(config: RequestDepositConfig) => TransactionInstruction
fulfillDeposit(config: FulfillDepositConfig) => TransactionInstruction

// Withdrawal flow
withdrawWithPrice(config: WithdrawWithPriceConfig) => TransactionInstruction
requestWithdraw(config: RequestWithdrawConfig) => TransactionInstruction
fulfillWithdraw(config: FulfillWithdrawConfig) => TransactionInstruction

// Rebalancing & management
execute(config: ExecuteConfig) => TransactionInstruction
setSharePrice(config: SetSharePriceConfig) => TransactionInstruction
collectFees(config: CollectFeesConfig) => TransactionInstruction
updateFees(config: UpdateFeesConfig) => TransactionInstruction
addOwner(config: AddOwnerConfig) => TransactionInstruction
removeOwner(config: RemoveOwnerConfig) => TransactionInstruction
```

### 4 PDA Derivation Helpers

Derive Program-Derived Accounts used by the vault program:

```typescript
deriveVaultStatePda(vaultAddress: PublicKey, programId?: PublicKey)
derivePendingDepositPda(vaultAddress: PublicKey, userId: PublicKey, programId?: PublicKey)
derivePendingWithdrawPda(vaultAddress: PublicKey, userId: PublicKey, programId?: PublicKey)
deriveShareMintPda(vaultAddress: PublicKey, programId?: PublicKey)
```

### 3 State Deserializers

Deserialize on-chain state structures:

```typescript
deserializeVaultState(buffer: Buffer) => VaultState
deserializePendingDeposit(buffer: Buffer) => PendingDeposit
deserializePendingWithdraw(buffer: Buffer) => PendingWithdraw
```

### Fee Math & Utilities

Calculate and validate fees:

```typescript
calculateEntryFee(depositAmount: bigint, feeConfig: FeeConfig) => bigint
calculateExitFee(withdrawAmount: bigint, feeConfig: FeeConfig) => bigint
calculateManagementFee(totalValue: bigint, feeConfig: FeeConfig, periodInDays: number) => bigint
calculatePerformanceFee(profitAmount: bigint, feeConfig: FeeConfig) => bigint
```

### Error Codes

Comprehensive error handling:

```typescript
// Program error codes (0x100–0x10E)
export enum VaultErrorCode {
  Unauthorized = 0x100,
  InvalidSharePrice = 0x101,
  // ... through
  UnauthorizedInitializer = 0x10E,
}
```

## Data Types

### Instruction Configs (use bigint for u64/i64)

```typescript
interface DepositWithPriceConfig {
  vaultAddress: PublicKey;
  depositAmount: bigint;           // u64 with full precision
  expectedSharesOut: bigint;
  signerPublicKey: PublicKey;
  programId?: PublicKey;            // Optional, defaults to mainnet
}

interface FeeConfig {
  entryFeePercentage: number;       // 0-100
  exitFeePercentage: number;
  managementFeePercentage: number;
  performanceFeePercentage: number;
}
```

### State Structures (deserialized)

```typescript
interface VaultState {
  authority: PublicKey;
  sharesMint: PublicKey;
  totalShares: bigint;              // u64
  totalDeposited: bigint;           // u128
  totalWithdrawn: bigint;           // u128
  fees: FeeConfig;
  isActive: boolean;
  // ... more fields
}

interface PendingDeposit {
  userId: PublicKey;
  depositAmount: bigint;            // u64
  expectedSharesOut: bigint;
  requestedAt: bigint;             // Unix timestamp
  fulfilled: boolean;
}

interface PendingWithdraw {
  userId: PublicKey;
  sharesBurned: bigint;
  expectedAmountOut: bigint;
  requestedAt: bigint;
  fulfilled: boolean;
}
```

## Usage in Apps

The SDK is consumed by `apps/back/` (Fastify backend) to construct vault transactions:

```typescript
import {
  initializeVault,
  depositWithPrice,
  deriveVaultStatePda,
  deserializeVaultState,
  calculateEntryFee,
} from "@repo/omaha-programs-sdk";
import { PublicKey, Connection, Transaction } from "@solana/web3.js";

// Build a deposit instruction
const depositIx = depositWithPrice({
  vaultAddress: new PublicKey("..."),
  depositAmount: BigInt(1000000000),  // 1 SOL in lamports
  expectedSharesOut: BigInt(1000),
  signerPublicKey: userPubkey,
  // programId defaults to mainnet vault program
});

// Add to transaction
const tx = new Transaction().add(depositIx);

// Fetch and deserialize vault state
const connection = new Connection("https://api.mainnet-beta.solana.com");
const [vaultStatePda] = deriveVaultStatePda(vaultAddress);
const accountInfo = await connection.getAccountInfo(vaultStatePda);
const vaultState = deserializeVaultState(accountInfo!.data);

// Calculate fees
const entryFee = calculateEntryFee(BigInt(1000000000), vaultState.fees);
```

## Numeric Precision (bigint)

All u64 and i64 values use **bigint** for full precision:

```typescript
// Right: Use bigint for amounts
const amount: bigint = BigInt(1000000000);

// Wrong: Don't use number (loses precision above 2^53)
const amount: number = 1000000000;
```

## Optional Program ID

Most builders accept an optional `programId` parameter (defaults to mainnet vault program):

```typescript
// Mainnet (default)
depositWithPrice({
  vaultAddress: ...,
  depositAmount: ...,
  // programId not specified → uses mainnet address
});

// Devnet
depositWithPrice({
  vaultAddress: ...,
  depositAmount: ...,
  programId: new PublicKey("...devnet program..."),
});
```

## Testing

The package includes 56 tests across 4 test files:

```bash
# Run all tests
pnpm --filter @repo/omaha-programs-sdk test

# Run with coverage
pnpm --filter @repo/omaha-programs-sdk test -- --coverage

# Watch mode
pnpm --filter @repo/omaha-programs-sdk test -- --watch
```

Test categories:
- **instructions.test.ts** — Instruction builder validation and layout
- **pda.test.ts** — PDA derivation correctness
- **state.test.ts** — Buffer deserialization
- **utils.test.ts** — Fee calculations and utilities

## Build Configuration

### tsup.config.ts

```typescript
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,           // Generate .d.ts files
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

### Package Exports

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

## Adding New Instructions

When adding a new instruction to the vault program:

1. **Create instruction builder** in `src/instructions/my-instruction.ts`

```typescript
export function myInstruction(config: MyInstructionConfig): TransactionInstruction {
  const ix = new TransactionInstruction({
    keys: [
      // Instruction accounts...
    ],
    programId: config.programId ?? MAINNET_VAULT_PROGRAM_ID,
    data: Buffer.from([
      DISCRIMINATOR_MY_INSTRUCTION,
      // Serialized parameters...
    ]),
  });
  return ix;
}
```

2. **Add tests** in `__tests__/instructions.test.ts`

3. **Export from index** in `src/instructions/index.ts`

4. **Export from main index** in `src/index.ts`

5. **Update this doc** with the new instruction

## Important Notes

- Always use `.js` extension in imports (ESM requirement)
- Run `pnpm --filter @repo/omaha-programs-sdk build` after changes
- Turborepo handles rebuild automatically during `pnpm dev`
- Never use the Anchor IDL; manually maintain instruction discriminators and layouts
- Use bigint for all u64/i64 values to avoid precision loss
- All instruction configs should accept optional `programId` for devnet/mainnet flexibility
- Maintain 80%+ test coverage for all instruction builders and state deserializers

## Related Packages

- **`@repo/shared`** — Shared types and validation (imports from omaha-programs-sdk where needed)
- **`@repo/database`** — Prisma ORM (vault data storage)
- **`apps/back`** — Fastify backend (primary consumer)
- **`apps/programs/vault`** — Solana Rust program (source of truth for instruction layouts)
