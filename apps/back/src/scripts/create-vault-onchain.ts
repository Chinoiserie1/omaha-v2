/**
 * Create a Vault On-Chain (all parameters exposed)
 *
 * Usage:
 *   pnpm create-vault-onchain --name <vault-name> [options]
 *
 * Required:
 *   --name <string>             Vault name (1-32 chars, used in PDA seed)
 *
 * Optional - Initialize:
 *   --keypair <key>             Admin private key (base58/JSON/base64)
 *   --base-mint <pubkey>        Base token mint (default: USDC devnet)
 *   --share-decimals <number>   Share token decimals (default: 6)
 *   --share-price <number>      Initial share price in base smallest units (default: 1000000)
 *   --symbol <string>           Share token symbol (default: auto-derived from name)
 *   --uri <string>              Share token metadata URI (default: empty)
 *
 * Optional - Fees (triggers UpdateFees after Initialize):
 *   --entry-fee-bps <number>    Entry fee in BPS (max 1000)
 *   --exit-fee-bps <number>     Exit fee in BPS (max 1000)
 *   --management-fee-bps <n>    Management fee in BPS (max 1000)
 *   --performance-fee-bps <n>   Performance fee in BPS (max 5000)
 *   --fee-receiver <pubkey>     Fee receiver address (required if any fee > 0)
 *
 * Optional - Operators (triggers AddOperator after Initialize):
 *   --operator <pubkey>         Operator to add (repeatable, max 10)
 *
 * Optional - Infrastructure:
 *   --rpc-url <url>             Solana RPC URL (default: devnet)
 *   --program-id <pubkey>       Vault program ID override
 *   --dry-run                   Preview only, do not send transaction
 *
 * Env fallbacks:
 *   KEEPER_PRIVATE_KEY          for --keypair
 *   SOLANA_RPC_URL              for --rpc-url
 */
import { type Connection, type Keypair, PublicKey } from "@solana/web3.js";
import {
  createInitializeInstruction,
  createUpdateFeesInstruction,
  createAddOperatorInstruction,
  findFactoryPda,
  findVaultStatePda,
  findShareMintPda,
  deserializeFactoryState,
  validateFeeBps,
  VAULT_PROGRAM_ID,
  MAX_ENTRY_EXIT_FEE_BPS,
  MAX_MANAGEMENT_FEE_BPS,
  MAX_PERFORMANCE_FEE_BPS,
  MAX_OPERATORS,
} from "@repo/omaha-programs-sdk";
import {
  parseFlag,
  parseFlagAll,
  hasFlag,
  resolveKeypair,
  resolveConnection,
  resolveProgramId,
  sendTransaction,
} from "./script-args.js";

// USDC devnet mint
const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

interface VaultArgs {
  readonly name: string;
  readonly baseMint: PublicKey;
  readonly shareDecimals: number;
  readonly sharePrice: bigint;
  readonly symbol: string;
  readonly uri: string;
  readonly entryFeeBps: number | undefined;
  readonly exitFeeBps: number | undefined;
  readonly managementFeeBps: number | undefined;
  readonly performanceFeeBps: number | undefined;
  readonly feeReceiver: PublicKey | undefined;
  readonly operators: readonly PublicKey[];
  readonly dryRun: boolean;
  readonly programId: PublicKey;
  readonly signer: Keypair;
  readonly connection: Connection;
}

function printUsage(): never {
  console.error(
    "Usage:\n" +
      "  pnpm create-vault-onchain --name <vault-name> [options]\n" +
      "\nRequired:\n" +
      "  --name <string>             Vault name (1-32 chars)\n" +
      "\nOptional - Initialize:\n" +
      "  --keypair <key>             Admin private key (base58/JSON/base64)\n" +
      "  --base-mint <pubkey>        Base token mint (default: USDC devnet)\n" +
      "  --share-decimals <number>   Share token decimals (default: 6)\n" +
      "  --share-price <number>      Initial share price (default: 1000000)\n" +
      "  --symbol <string>           Share token symbol (default: auto-derived)\n" +
      "  --uri <string>              Metadata URI (default: empty)\n" +
      "\nOptional - Fees:\n" +
      "  --entry-fee-bps <number>    Entry fee BPS (max 1000)\n" +
      "  --exit-fee-bps <number>     Exit fee BPS (max 1000)\n" +
      "  --management-fee-bps <n>    Management fee BPS (max 1000)\n" +
      "  --performance-fee-bps <n>   Performance fee BPS (max 5000)\n" +
      "  --fee-receiver <pubkey>     Fee receiver (required if any fee > 0)\n" +
      "\nOptional - Operators:\n" +
      "  --operator <pubkey>         Operator to add (repeatable, max 10)\n" +
      "\nOptional - Infrastructure:\n" +
      "  --rpc-url <url>             Solana RPC URL (default: devnet)\n" +
      "  --program-id <pubkey>       Vault program ID override\n" +
      "  --dry-run                   Preview only, no transaction\n" +
      "\nEnv fallbacks:\n" +
      "  KEEPER_PRIVATE_KEY          for --keypair\n" +
      "  SOLANA_RPC_URL              for --rpc-url\n",
  );
  process.exit(1);
}

function parseVaultArgs(argv: readonly string[]): VaultArgs {
  const name = parseFlag(argv, "--name");
  if (!name) {
    console.error("ERROR: --name is required.");
    printUsage();
  }
  if (name.length < 1 || name.length > 32) {
    console.error("ERROR: --name must be 1-32 characters.");
    process.exit(1);
  }

  const baseMintRaw = parseFlag(argv, "--base-mint");
  const baseMint = baseMintRaw ? new PublicKey(baseMintRaw) : USDC_DEVNET_MINT;

  const shareDecimalsRaw = parseFlag(argv, "--share-decimals");
  const shareDecimals = shareDecimalsRaw ? Number(shareDecimalsRaw) : 6;
  if (shareDecimals < 0 || shareDecimals > 18 || !Number.isInteger(shareDecimals)) {
    console.error("ERROR: --share-decimals must be an integer 0-18.");
    process.exit(1);
  }

  const sharePriceRaw = parseFlag(argv, "--share-price");
  const sharePrice = sharePriceRaw ? BigInt(sharePriceRaw) : BigInt(1_000_000);
  if (sharePrice <= 0n) {
    console.error("ERROR: --share-price must be > 0.");
    process.exit(1);
  }

  const symbol = parseFlag(argv, "--symbol") ?? name.slice(0, 10).toUpperCase();
  const uri = parseFlag(argv, "--uri") ?? "";

  // Fees
  const entryFeeBpsRaw = parseFlag(argv, "--entry-fee-bps");
  const exitFeeBpsRaw = parseFlag(argv, "--exit-fee-bps");
  const managementFeeBpsRaw = parseFlag(argv, "--management-fee-bps");
  const performanceFeeBpsRaw = parseFlag(argv, "--performance-fee-bps");
  const feeReceiverRaw = parseFlag(argv, "--fee-receiver");

  const entryFeeBps = entryFeeBpsRaw ? Number(entryFeeBpsRaw) : undefined;
  const exitFeeBps = exitFeeBpsRaw ? Number(exitFeeBpsRaw) : undefined;
  const managementFeeBps = managementFeeBpsRaw ? Number(managementFeeBpsRaw) : undefined;
  const performanceFeeBps = performanceFeeBpsRaw ? Number(performanceFeeBpsRaw) : undefined;
  const feeReceiver = feeReceiverRaw ? new PublicKey(feeReceiverRaw) : undefined;

  const hasFees =
    entryFeeBps !== undefined ||
    exitFeeBps !== undefined ||
    managementFeeBps !== undefined ||
    performanceFeeBps !== undefined;

  if (hasFees) {
    const entry = entryFeeBps ?? 0;
    const exit = exitFeeBps ?? 0;
    const mgmt = managementFeeBps ?? 0;
    const perf = performanceFeeBps ?? 0;
    const anyFeeAboveZero = entry > 0 || exit > 0 || mgmt > 0 || perf > 0;

    if (!validateFeeBps(entry, exit, mgmt, perf)) {
      console.error(
        `ERROR: Fee BPS out of range. Max entry/exit: ${MAX_ENTRY_EXIT_FEE_BPS}, ` +
          `max management: ${MAX_MANAGEMENT_FEE_BPS}, max performance: ${MAX_PERFORMANCE_FEE_BPS}`,
      );
      process.exit(1);
    }

    if (anyFeeAboveZero && !feeReceiver) {
      console.error("ERROR: --fee-receiver is required when any fee > 0.");
      process.exit(1);
    }
  }

  // Operators
  const operatorRaws = parseFlagAll(argv, "--operator");
  if (operatorRaws.length > MAX_OPERATORS) {
    console.error(`ERROR: Max ${MAX_OPERATORS} operators allowed.`);
    process.exit(1);
  }
  const operators = operatorRaws.map((raw) => new PublicKey(raw));

  const dryRun = hasFlag(argv, "--dry-run");
  const connection = resolveConnection(argv);
  const signer = resolveKeypair(argv, "--keypair", "KEEPER_PRIVATE_KEY");
  const programId = resolveProgramId(argv, PublicKey) ?? VAULT_PROGRAM_ID;

  return {
    name,
    baseMint,
    shareDecimals,
    sharePrice,
    symbol,
    uri,
    entryFeeBps,
    exitFeeBps,
    managementFeeBps,
    performanceFeeBps,
    feeReceiver,
    operators,
    dryRun,
    programId,
    signer,
    connection,
  };
}

function printPlan(
  args: VaultArgs,
  factoryPda: PublicKey,
  vaultStatePda: PublicKey,
  shareMintPda: PublicKey,
): void {
  const hasFees =
    args.entryFeeBps !== undefined ||
    args.exitFeeBps !== undefined ||
    args.managementFeeBps !== undefined ||
    args.performanceFeeBps !== undefined;

  console.log("=== Create Vault On-Chain ===\n");
  console.log("Initialize Parameters:");
  console.log(`  Name:           ${args.name}`);
  console.log(`  Symbol:         ${args.symbol}`);
  console.log(`  URI:            ${args.uri || "(none)"}`);
  console.log(`  Base Mint:      ${args.baseMint.toBase58()}`);
  console.log(`  Share Decimals: ${args.shareDecimals}`);
  console.log(`  Share Price:    ${args.sharePrice.toString()}`);
  console.log();
  console.log("Derived PDAs:");
  console.log(`  Factory State:  ${factoryPda.toBase58()}`);
  console.log(`  Vault State:    ${vaultStatePda.toBase58()}`);
  console.log(`  Share Mint:     ${shareMintPda.toBase58()}`);
  console.log();
  console.log(`Signer (Admin):   ${args.signer.publicKey.toBase58()}`);
  console.log(`Program ID:       ${args.programId.toBase58()}`);

  if (hasFees) {
    console.log();
    console.log("Fee Configuration:");
    console.log(`  Entry Fee:       ${args.entryFeeBps ?? 0} BPS`);
    console.log(`  Exit Fee:        ${args.exitFeeBps ?? 0} BPS`);
    console.log(`  Management Fee:  ${args.managementFeeBps ?? 0} BPS`);
    console.log(`  Performance Fee: ${args.performanceFeeBps ?? 0} BPS`);
    console.log(`  Fee Receiver:    ${args.feeReceiver?.toBase58() ?? "(none)"}`);
  }

  if (args.operators.length > 0) {
    console.log();
    console.log("Operators to add:");
    for (const op of args.operators) {
      console.log(`  - ${op.toBase58()}`);
    }
  }

  console.log();
  console.log("Transaction plan:");
  console.log("  1. Initialize vault");
  if (hasFees) console.log("  2. UpdateFees");
  if (args.operators.length > 0) {
    console.log(`  ${hasFees ? 3 : 2}. AddOperator × ${args.operators.length}`);
  }
  console.log();
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseVaultArgs(argv);

  const [factoryPda] = findFactoryPda(args.programId);
  const [vaultStatePda] = findVaultStatePda(args.name, args.programId);
  const [shareMintPda] = findShareMintPda(vaultStatePda, args.programId);

  // Pre-flight: check factory exists and is not paused
  const factoryInfo = await args.connection.getAccountInfo(factoryPda);
  if (!factoryInfo) {
    console.error("ERROR: Factory account not found on-chain:", factoryPda.toBase58());
    console.error("Initialize the factory first.");
    process.exit(1);
  }
  const factory = deserializeFactoryState(Buffer.from(factoryInfo.data));
  if (factory.isPaused) {
    console.error("ERROR: Factory is paused. Cannot create vaults.");
    process.exit(1);
  }

  // Pre-flight: check vault PDA does not already exist
  const existingVault = await args.connection.getAccountInfo(vaultStatePda);
  if (existingVault) {
    console.error(`ERROR: Vault "${args.name}" already exists at ${vaultStatePda.toBase58()}`);
    process.exit(1);
  }

  printPlan(args, factoryPda, vaultStatePda, shareMintPda);

  if (args.dryRun) {
    console.log("DRY RUN — no transaction sent.");
    return;
  }

  // Build instructions
  const instructions = [];

  // 1. Initialize
  instructions.push(
    createInitializeInstruction({
      factoryState: factoryPda,
      admin: args.signer.publicKey,
      vaultState: vaultStatePda,
      shareMint: shareMintPda,
      baseMint: args.baseMint,
      shareDecimals: args.shareDecimals,
      sharePrice: args.sharePrice,
      name: args.name,
      symbol: args.symbol,
      uri: args.uri,
      programId: args.programId,
    }),
  );

  // 2. UpdateFees (if any fee flag provided)
  const hasFees =
    args.entryFeeBps !== undefined ||
    args.exitFeeBps !== undefined ||
    args.managementFeeBps !== undefined ||
    args.performanceFeeBps !== undefined;

  if (hasFees) {
    instructions.push(
      createUpdateFeesInstruction({
        admin: args.signer.publicKey,
        vaultState: vaultStatePda,
        entryFeeBps: args.entryFeeBps ?? 0,
        exitFeeBps: args.exitFeeBps ?? 0,
        managementFeeBps: args.managementFeeBps ?? 0,
        performanceFeeBps: args.performanceFeeBps ?? 0,
        feeReceiver: args.feeReceiver ?? args.signer.publicKey,
        programId: args.programId,
      }),
    );
  }

  // 3. AddOperator (for each --operator)
  for (const operator of args.operators) {
    instructions.push(
      createAddOperatorInstruction({
        admin: args.signer.publicKey,
        vaultState: vaultStatePda,
        newOperator: operator,
        programId: args.programId,
      }),
    );
  }

  const txSig = await sendTransaction(
    args.connection,
    args.signer,
    instructions,
    `Create vault "${args.name}"`,
  );

  console.log("\nVault created successfully!");
  console.log(`  Tx:          ${txSig}`);
  console.log(`  Vault State: ${vaultStatePda.toBase58()}`);
  console.log(`  Share Mint:  ${shareMintPda.toBase58()}`);
  console.log(`  Admin:       ${args.signer.publicKey.toBase58()}`);
}

main().catch((error) => {
  console.error("Vault creation failed:", error);
  process.exit(1);
});
