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
 * @param envName - env var fallback (e.g. "KEEPER_PRIVATE_KEY")
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

/**
 * Resolve an RPC connection.
 * CLI: --rpc-url <url>  |  Env: SOLANA_RPC_URL
 */
export function resolveConnection(args: readonly string[]): Connection {
  const url = parseFlag(args, "--rpc-url") ?? process.env["SOLANA_RPC_URL"];
  if (!url) {
    console.error("ERROR: Provide --rpc-url <url> or set SOLANA_RPC_URL env var.");
    process.exit(1);
  }
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
