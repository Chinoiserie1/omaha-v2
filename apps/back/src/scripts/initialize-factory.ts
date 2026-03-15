/**
 * Initialize the Factory (one-time setup)
 *
 * Creates the singleton factory PDA on-chain. Requires both the
 * program authority keypair and the owner keypair as signers.
 *
 * Usage:
 *   pnpm initialize-factory [options]
 *
 * Options:
 *   --keypair <key>                Owner private key (base58/JSON/base64)
 *   --program-authority <key>      Program authority private key
 *   --rpc-url <url>                Solana RPC URL (default: devnet)
 *   --program-id <pubkey>          Vault program ID override
 *   --dry-run                      Preview only, do not send transaction
 *
 * Env fallbacks:
 *   KEEPER_PRIVATE_KEY             for --keypair
 *   PROGRAM_AUTHORITY_PRIVATE_KEY  for --program-authority
 *   SOLANA_RPC_URL                 for --rpc-url
 */
import { PublicKey } from "@solana/web3.js";
import {
  createInitializeFactoryInstruction,
  findFactoryPda,
  VAULT_PROGRAM_ID,
} from "@repo/omaha-programs-sdk";
import {
  hasFlag,
  resolveKeypair,
  resolveConnection,
  resolveProgramId,
  sendTransaction,
} from "./script-args.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  const connection = resolveConnection(argv);
  const owner = resolveKeypair(argv, "--keypair", "KEEPER_PRIVATE_KEY");
  const programAuthority = resolveKeypair(argv, "--program-authority", "PROGRAM_AUTHORITY_PRIVATE_KEY");
  const programId = resolveProgramId(argv, PublicKey) ?? VAULT_PROGRAM_ID;
  const dryRun = hasFlag(argv, "--dry-run");

  const [factoryPda] = findFactoryPda(programId);

  // Pre-flight: check factory doesn't already exist
  const existing = await connection.getAccountInfo(factoryPda);
  if (existing) {
    console.error(`Factory already exists at ${factoryPda.toBase58()}`);
    process.exit(1);
  }

  console.log("=== Initialize Factory ===\n");
  console.log(`  Factory PDA:        ${factoryPda.toBase58()}`);
  console.log(`  Owner:              ${owner.publicKey.toBase58()}`);
  console.log(`  Program Authority:  ${programAuthority.publicKey.toBase58()}`);
  console.log(`  Program ID:         ${programId.toBase58()}`);
  console.log();

  if (dryRun) {
    console.log("DRY RUN — no transaction sent.");
    return;
  }

  const ix = createInitializeFactoryInstruction({
    programAuthority: programAuthority.publicKey,
    owner: owner.publicKey,
    factoryState: factoryPda,
    programId,
  });

  const txSig = await sendTransaction(
    connection,
    owner,
    [ix],
    "Initialize factory",
    [programAuthority],
  );

  console.log("Factory initialized!");
  console.log(`  Tx:          ${txSig}`);
  console.log(`  Factory PDA: ${factoryPda.toBase58()}`);
  console.log(`  Owner:       ${owner.publicKey.toBase58()}`);
}

main().catch((error) => {
  console.error("Factory initialization failed:", error);
  process.exit(1);
});
