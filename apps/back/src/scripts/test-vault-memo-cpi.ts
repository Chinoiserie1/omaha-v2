/**
 * Phase 1: Test Execute CPI — Memo Program
 *
 * Simplest possible CPI test. Sends a memo message through the vault's
 * Execute (0x04) instruction, proving:
 *   - Execute CPI passthrough works
 *   - Vault PDA signs via invoke_signed
 *   - Operator authorization is valid
 *
 * Usage:
 *   pnpm test:vault:memo -- --vault-name <name> [options]
 *
 * Required:
 *   --vault-name <string>     Vault name (used to derive PDA)
 *
 * Optional:
 *   --message <string>        Memo message (default: "omaha vault execute cpi test")
 *   --keypair <key>           Operator private key (base58/JSON/base64)
 *   --rpc-url <url>           Solana RPC URL (default: devnet)
 *   --program-id <pubkey>     Vault program ID override
 *   --dry-run                 Preview only, no transaction
 *
 * Env fallbacks:
 *   ADMIN_PROGRAM_PRIVATE_KEY        for --keypair
 *   SOLANA_RPC_URL            for --rpc-url
 */
import { PublicKey } from "@solana/web3.js";
import {
  createExecuteInstruction,
  findVaultStatePda,
  VAULT_PROGRAM_ID,
} from "@repo/omaha-programs-sdk";
import {
  parseFlag,
  hasFlag,
  resolveKeypair,
  resolveConnection,
  resolveProgramId,
  sendTransaction,
} from "./script-args.js";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  const vaultName = parseFlag(argv, "--vault-name");
  if (!vaultName) {
    console.error("ERROR: --vault-name is required.");
    process.exit(1);
  }

  const message =
    parseFlag(argv, "--message") ?? "omaha vault execute cpi test";
  const signer = resolveKeypair(argv, "--keypair", "ADMIN_PROGRAM_PRIVATE_KEY");
  const connection = resolveConnection(argv);
  const programId = resolveProgramId(argv, PublicKey) ?? VAULT_PROGRAM_ID;
  const dryRun = hasFlag(argv, "--dry-run");

  const [vaultStatePda] = findVaultStatePda(vaultName, programId);

  console.log("=== Phase 1: Memo CPI Test ===\n");
  console.log(`Vault:      ${vaultName} (${vaultStatePda.toBase58()})`);
  console.log(`Operator:   ${signer.publicKey.toBase58()}`);
  console.log(`Message:    "${message}"`);
  console.log(`Program ID: ${programId.toBase58()}\n`);

  // Verify vault exists on-chain
  const vaultInfo = await connection.getAccountInfo(vaultStatePda);
  if (!vaultInfo) {
    console.error(
      `ERROR: Vault "${vaultName}" not found at ${vaultStatePda.toBase58()}`,
    );
    process.exit(1);
  }
  console.log(`Vault account found (${vaultInfo.data.length} bytes)\n`);

  if (dryRun) {
    console.log("DRY RUN — no transaction sent.");
    return;
  }

  // Build Execute CPI wrapping a Memo instruction.
  //
  // Memo program accounts: [signer] — the vault PDA will be marked as signer
  // during CPI by the Execute handler (it matches vault_state key).
  const memoData = Buffer.from(message, "utf-8");

  const executeIx = createExecuteInstruction({
    operator: signer.publicKey,
    vaultState: vaultStatePda,
    targetProgram: MEMO_PROGRAM_ID,
    remainingAccounts: [
      { pubkey: vaultStatePda, isSigner: false, isWritable: false },
    ],
    targetInstructionData: memoData,
    programId,
  });

  const txSig = await sendTransaction(
    connection,
    signer,
    [executeIx],
    "Memo CPI via Execute",
  );

  console.log("\nPASSED — Memo CPI succeeded");
  console.log(
    `  Tx: https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
  );
}

main().catch((error) => {
  console.error("\nFAILED:", error);
  process.exit(1);
});
