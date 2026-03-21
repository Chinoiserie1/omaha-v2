/**
 * Shared CLI argument parsing utilities for admin scripts.
 *
 * All flags use `--flag value` or `--flag=value` syntax.
 * Each flag falls back to an env var if not provided on the CLI.
 */
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  type PublicKey,
  type TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

/** Parse a single `--flag value` or `--flag=value` from argv. Returns undefined if not found. */
export function parseFlag(args: readonly string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    // --flag=value
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
    // --flag value
    if (arg === flag && i + 1 < args.length) {
      return args[i + 1]!;
    }
  }
  return undefined;
}

/** Collect ALL values for a repeatable `--flag value` or `--flag=value`. */
export function parseFlagAll(args: readonly string[], flag: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith(`${flag}=`)) {
      results.push(arg.slice(flag.length + 1));
    } else if (arg === flag && i + 1 < args.length) {
      results.push(args[i + 1]!);
      i++;
    }
  }
  return results;
}

/** Check if a boolean flag is present (e.g. --dry-run). */
export function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag);
}

/** Collect positional args (anything not starting with --). */
export function positionalArgs(args: readonly string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      // skip the value of --flag value pairs
      if (!arg.includes("=") && i + 1 < args.length && !args[i + 1]!.startsWith("--")) {
        i++;
      }
      continue;
    }
    result.push(arg);
  }
  return result;
}

/** Parse a keypair from a raw string (JSON array, base58, or base64). */
export function keypairFromRaw(raw: string): Keypair {
  const bytes = (() => {
    try {
      return Uint8Array.from(JSON.parse(raw));
    } catch {
      try {
        return bs58.decode(raw);
      } catch {
        return Buffer.from(raw, "base64");
      }
    }
  })();

  if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
  if (bytes.length === 32) return Keypair.fromSeed(bytes);
  throw new Error(`Unexpected key length: ${bytes.length} (expected 32 or 64)`);
}

/**
 * Resolve a keypair from CLI flag, falling back to env var.
 * @param args  - process.argv.slice(2)
 * @param flag  - CLI flag name (e.g. "--keypair")
 * @param envName - env var fallback (e.g. "ADMIN_PROGRAM_PRIVATE_KEY")
 */
export function resolveKeypair(
  args: readonly string[],
  flag: string,
  envName: string,
): Keypair {
  const raw = parseFlag(args, flag) ?? process.env[envName];
  if (!raw) {
    console.error(`ERROR: Provide ${flag} <private-key> or set ${envName} env var.`);
    process.exit(1);
  }
  return keypairFromRaw(raw);
}

const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

/**
 * Resolve an RPC connection.
 *
 * Priority:
 *   1. --rpc-url <url>             (explicit URL always wins)
 *   2. --chain mainnet | devnet    (picks a default URL per chain)
 *   3. Default: devnet
 *
 * When --chain mainnet is used, SOLANA_RPC_URL env var is used if set
 * (typically a paid RPC like Helius). For devnet the public endpoint is fine.
 */
export function resolveConnection(args: readonly string[]): Connection {
  const explicitUrl = parseFlag(args, "--rpc-url");
  if (explicitUrl) {
    return new Connection(explicitUrl, "confirmed");
  }

  const chain = parseFlag(args, "--chain") ?? "devnet";
  if (chain !== "devnet" && chain !== "mainnet") {
    console.error(`ERROR: --chain must be "devnet" or "mainnet", got "${chain}".`);
    process.exit(1);
  }

  const url =
    chain === "mainnet"
      ? (process.env["SOLANA_RPC_URL"] ?? MAINNET_RPC_URL)
      : DEVNET_RPC_URL;

  return new Connection(url, "confirmed");
}

/**
 * Resolve an optional program ID override.
 * CLI: --program-id <pubkey>
 * Returns undefined if not provided (SDK uses its default).
 */
export function resolveProgramId(
  args: readonly string[],
  PublicKeyClass: { new (value: string): PublicKey },
): PublicKey | undefined {
  const raw = parseFlag(args, "--program-id");
  return raw ? new PublicKeyClass(raw) : undefined;
}

/**
 * Build, sign, send, and confirm a versioned transaction.
 * Standalone — does not depend on the global getKeeper()/getConnection() singletons.
 */
export async function sendTransaction(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  description: string,
  additionalSigners: Keypair[] = [],
): Promise<string> {
  const allIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ...instructions,
  ];

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: allIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([payer, ...additionalSigners]);

  console.log(`Sending: ${description}`);
  const sig = await connection.sendTransaction(tx, { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");

  console.log(`Confirmed: ${sig}`);
  return sig;
}
