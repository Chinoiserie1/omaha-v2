/**
 * Phase 2: Test Execute CPI — SPL Token Transfer
 *
 * Transfers tokens from the vault's ATA through the Execute (0x04) instruction,
 * proving the vault PDA can sign token operations via CPI.
 *
 * The vault must hold tokens in its base-mint ATA before running this test.
 *
 * Usage:
 *   pnpm test:vault:transfer -- --vault-name <name> [options]
 *
 * Required:
 *   --vault-name <string>     Vault name (used to derive PDA)
 *
 * Optional:
 *   --amount <number>         Amount in smallest units (default: 1000 = 0.001 USDC)
 *   --destination <pubkey>    Destination wallet (default: operator wallet)
 *   --keypair <key>           Operator private key (base58/JSON/base64)
 *   --rpc-url <url>           Solana RPC URL (default: devnet)
 *   --program-id <pubkey>     Vault program ID override
 *   --dry-run                 Preview balances, no transaction
 *
 * Env fallbacks:
 *   ADMIN_PROGRAM_PRIVATE_KEY        for --keypair
 *   SOLANA_RPC_URL            for --rpc-url
 */
import { PublicKey } from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createExecuteInstruction,
  findVaultStatePda,
  deserializeVaultState,
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  const vaultName = parseFlag(argv, "--vault-name");
  if (!vaultName) {
    console.error("ERROR: --vault-name is required.");
    process.exit(1);
  }

  const amountRaw = parseFlag(argv, "--amount");
  const amount = amountRaw ? BigInt(amountRaw) : BigInt(1000);
  const destinationRaw = parseFlag(argv, "--destination");

  const signer = resolveKeypair(argv, "--keypair", "ADMIN_PROGRAM_PRIVATE_KEY");
  const connection = resolveConnection(argv);
  const programId = resolveProgramId(argv, PublicKey) ?? VAULT_PROGRAM_ID;
  const dryRun = hasFlag(argv, "--dry-run");

  const [vaultStatePda] = findVaultStatePda(vaultName, programId);

  console.log("=== Phase 2: Token Transfer CPI Test ===\n");
  console.log(`Vault:      ${vaultName} (${vaultStatePda.toBase58()})`);
  console.log(`Operator:   ${signer.publicKey.toBase58()}`);
  console.log(`Amount:     ${amount.toString()} smallest units`);
  console.log(`Program ID: ${programId.toBase58()}\n`);

  // Read vault state to get base_mint
  const vaultInfo = await connection.getAccountInfo(vaultStatePda);
  if (!vaultInfo) {
    console.error(
      `ERROR: Vault "${vaultName}" not found at ${vaultStatePda.toBase58()}`,
    );
    process.exit(1);
  }

  const vaultState = deserializeVaultState(Buffer.from(vaultInfo.data));
  const baseMint = vaultState.baseMint;
  console.log(`Base Mint:  ${baseMint.toBase58()}`);

  // Derive ATAs
  // allowOwnerOffCurve = true because vault PDA is off-curve
  const vaultAta = getAssociatedTokenAddressSync(
    baseMint,
    vaultStatePda,
    true,
  );
  const destination = destinationRaw
    ? new PublicKey(destinationRaw)
    : signer.publicKey;
  const destinationAta = getAssociatedTokenAddressSync(baseMint, destination);

  console.log(`Source ATA: ${vaultAta.toBase58()} (vault)`);
  console.log(`Dest ATA:   ${destinationAta.toBase58()} (${destination.toBase58()})\n`);

  // Check vault ATA balance
  try {
    const balance = await connection.getTokenAccountBalance(vaultAta);
    console.log(
      `Vault ATA balance: ${balance.value.uiAmountString} (${balance.value.amount} raw)\n`,
    );

    if (BigInt(balance.value.amount) < amount) {
      console.error(
        `ERROR: Insufficient balance — need ${amount}, have ${balance.value.amount}`,
      );
      console.error(
        "Fund the vault ATA first:\n" +
          `  spl-token transfer ${baseMint.toBase58()} <amount> ${vaultAta.toBase58()} --url devnet`,
      );
      process.exit(1);
    }
  } catch {
    console.error(
      `ERROR: Vault ATA not found at ${vaultAta.toBase58()}`,
    );
    console.error(
      "The vault has no token account for the base mint. " +
        "Create it and fund it first.",
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log("DRY RUN — no transaction sent.");
    return;
  }

  // 1. Create destination ATA if it doesn't exist (normal ix, not via Execute CPI)
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    signer.publicKey,
    destinationAta,
    destination,
    baseMint,
  );

  // 2. Build SPL Token Transfer instruction
  //    Source: vault ATA, Dest: destination ATA, Authority: vault PDA
  const transferIx = createTransferInstruction(
    vaultAta,
    destinationAta,
    vaultStatePda, // authority — will sign via CPI
    amount,
  );

  // 3. Wrap the transfer in Execute CPI
  //    All accounts set to isSigner: false — the Execute handler marks
  //    the vault PDA as signer during invoke_signed.
  const executeIx = createExecuteInstruction({
    operator: signer.publicKey,
    vaultState: vaultStatePda,
    targetProgram: TOKEN_PROGRAM_ID,
    remainingAccounts: transferIx.keys.map((key) => ({
      pubkey: key.pubkey,
      isSigner: false,
      isWritable: key.isWritable,
    })),
    targetInstructionData: transferIx.data as Buffer,
    programId,
  });

  const txSig = await sendTransaction(
    connection,
    signer,
    [createAtaIx, executeIx],
    "Token Transfer via Execute CPI",
  );

  console.log("\nPASSED — Token Transfer CPI succeeded");
  console.log(
    `  Tx: https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
  );

  // Verify new balance
  const newBalance = await connection.getTokenAccountBalance(vaultAta);
  console.log(
    `  New vault balance: ${newBalance.value.uiAmountString} (${newBalance.value.amount} raw)`,
  );
}

main().catch((error) => {
  console.error("\nFAILED:", error);
  process.exit(1);
});
