/**
 * Phase 3: Test Execute CPI — Raydium Swap (Devnet)
 *
 * Executes a token swap through Raydium's devnet API wrapped in the vault's
 * Execute (0x04) instruction. Proves the full rebalance path works:
 *   - Raydium quote + transaction building
 *   - Transaction deserialization and instruction extraction
 *   - Multi-instruction Execute CPI with ALT support
 *   - Vault PDA signing complex DeFi interactions
 *
 * The vault must hold input tokens before running this test.
 *
 * Usage:
 *   pnpm test:vault:swap -- --vault-name <name> --input-mint <mint> --output-mint <mint> --amount <n> [options]
 *
 * Required:
 *   --vault-name <string>     Vault name (used to derive PDA)
 *   --input-mint <pubkey>     Input token mint
 *   --output-mint <pubkey>    Output token mint
 *   --amount <number>         Amount in smallest units of input token
 *
 * Optional:
 *   --slippage-bps <number>   Slippage tolerance in BPS (default: 100 = 1%)
 *   --keypair <key>           Operator private key (base58/JSON/base64)
 *   --rpc-url <url>           Solana RPC URL (default: devnet)
 *   --program-id <pubkey>     Vault program ID override
 *   --dry-run                 Get quote only, no transaction
 *
 * Env fallbacks:
 *   ADMIN_PROGRAM_PRIVATE_KEY        for --keypair
 *   SOLANA_RPC_URL            for --rpc-url
 */
import axios from "axios";
import {
  type AddressLookupTableAccount,
  ComputeBudgetProgram,
  type Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
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
} from "./script-args.js";

const RAYDIUM_DEVNET_SWAP_HOST = "https://transaction-v1-devnet.raydium.io";
const SOL_MINT = "So11111111111111111111111111111111111111112";

// ── Helpers ───────────────────────────────────────────────────────

function wrapInExecuteCpi(
  ix: TransactionInstruction,
  vaultStatePda: PublicKey,
  operator: PublicKey,
  vaultProgramId: PublicKey,
): TransactionInstruction {
  return createExecuteInstruction({
    operator,
    vaultState: vaultStatePda,
    targetProgram: ix.programId,
    remainingAccounts: ix.keys.map((key) => ({
      pubkey: key.pubkey,
      isSigner: false, // vault PDA signs via CPI, not directly
      isWritable: key.isWritable,
    })),
    targetInstructionData: ix.data as Buffer,
    programId: vaultProgramId,
  });
}

async function resolveAltAccounts(
  connection: Connection,
  message: VersionedTransaction["message"],
): Promise<AddressLookupTableAccount[]> {
  if (!("addressTableLookups" in message)) return [];
  const lookups = message.addressTableLookups;
  if (lookups.length === 0) return [];

  const results: AddressLookupTableAccount[] = [];
  for (const lookup of lookups) {
    const res = await connection.getAddressLookupTable(lookup.accountKey);
    if (res.value) {
      results.push(res.value);
    } else {
      console.warn(
        `  WARNING: Failed to resolve ALT ${lookup.accountKey.toBase58()}`,
      );
    }
  }
  return results;
}

function isComputeBudgetIx(ix: TransactionInstruction): boolean {
  return ix.programId.equals(ComputeBudgetProgram.programId);
}

// ── Main ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  const vaultName = parseFlag(argv, "--vault-name");
  if (!vaultName) {
    console.error("ERROR: --vault-name is required.");
    process.exit(1);
  }

  const inputMint = parseFlag(argv, "--input-mint");
  const outputMint = parseFlag(argv, "--output-mint");
  if (!inputMint || !outputMint) {
    console.error("ERROR: --input-mint and --output-mint are required.");
    process.exit(1);
  }

  const amountRaw = parseFlag(argv, "--amount");
  if (!amountRaw) {
    console.error(
      "ERROR: --amount is required (in smallest units of input token).",
    );
    process.exit(1);
  }

  const slippageBps = Number(parseFlag(argv, "--slippage-bps") ?? "100");
  const signer = resolveKeypair(argv, "--keypair", "ADMIN_PROGRAM_PRIVATE_KEY");
  const connection = resolveConnection(argv);
  const programId = resolveProgramId(argv, PublicKey) ?? VAULT_PROGRAM_ID;
  const dryRun = hasFlag(argv, "--dry-run");

  const [vaultStatePda] = findVaultStatePda(vaultName, programId);
  const isInputSol = inputMint === SOL_MINT;
  const isOutputSol = outputMint === SOL_MINT;

  console.log("=== Phase 3: Raydium Swap CPI Test ===\n");
  console.log(`Vault:       ${vaultName} (${vaultStatePda.toBase58()})`);
  console.log(`Operator:    ${signer.publicKey.toBase58()}`);
  console.log(`Input Mint:  ${inputMint}`);
  console.log(`Output Mint: ${outputMint}`);
  console.log(`Amount:      ${amountRaw} smallest units`);
  console.log(`Slippage:    ${slippageBps} BPS`);
  console.log(`Program ID:  ${programId.toBase58()}\n`);

  // Verify vault exists
  const vaultInfo = await connection.getAccountInfo(vaultStatePda);
  if (!vaultInfo) {
    console.error(
      `ERROR: Vault "${vaultName}" not found at ${vaultStatePda.toBase58()}`,
    );
    process.exit(1);
  }
  console.log(`Vault account found (${vaultInfo.data.length} bytes)\n`);

  // ── Step 1: Get Raydium swap route ────────────────────────────

  console.log("1. Getting Raydium swap route...");
  let computeData: unknown;
  try {
    const { data } = await axios.get(
      `${RAYDIUM_DEVNET_SWAP_HOST}/compute/swap-base-in`,
      {
        params: {
          inputMint,
          outputMint,
          amount: amountRaw,
          slippageBps,
          txVersion: "V0",
        },
      },
    );
    computeData = data;

    // Try to log quote info
    const quote = data as Record<string, unknown>;
    const inner = (quote["data"] ?? quote) as Record<string, unknown>;
    if (inner["outputAmount"]) {
      console.log(`   Output amount: ${String(inner["outputAmount"])}`);
    }
    if (inner["priceImpactPct"] !== undefined) {
      console.log(`   Price impact:  ${String(inner["priceImpactPct"])}%`);
    }
    console.log("   Route found.");
  } catch (err: unknown) {
    const axiosErr = err as {
      response?: { data?: unknown; status?: number };
    };
    console.error(
      "Raydium compute failed:",
      axiosErr.response?.data ?? err,
    );
    console.error(
      "\nNo swap route found on Raydium devnet. Possible causes:",
    );
    console.error("  - No pool exists for this token pair on devnet");
    console.error("  - The Raydium devnet API is down");
    console.error("  - Invalid mint addresses");
    console.error(
      "\nTo create a pool, use the Raydium UI in devnet mode or the SDK.",
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log("\nDRY RUN — no transaction sent.");
    return;
  }

  // ── Step 2: Get swap transaction ──────────────────────────────

  console.log("\n2. Building swap transaction...");
  let txEntries: { transaction: string }[];
  try {
    const { data } = await axios.post(
      `${RAYDIUM_DEVNET_SWAP_HOST}/transaction/swap-base-in`,
      {
        computeUnitPriceMicroLamports: "100000",
        swapResponse: computeData,
        txVersion: "V0",
        wallet: vaultStatePda.toBase58(),
        wrapSol: isInputSol,
        unwrapSol: isOutputSol,
      },
    );

    // Handle both { data: [...] } and direct array response shapes
    const inner = data as Record<string, unknown>;
    const innerData = inner["data"];
    txEntries = (
      Array.isArray(innerData)
        ? innerData
        : Array.isArray(data)
          ? data
          : [data]
    ) as { transaction: string }[];

    console.log(`   Got ${txEntries.length} transaction(s).`);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: unknown } };
    console.error(
      "Raydium transaction build failed:",
      axiosErr.response?.data ?? err,
    );
    process.exit(1);
  }

  // ── Step 3: Process each transaction ──────────────────────────

  for (let i = 0; i < txEntries.length; i++) {
    const entry = txEntries[i]!;
    console.log(
      `\n3${txEntries.length > 1 ? `.${i + 1}` : ""}. Extracting and wrapping instructions...`,
    );

    // Deserialize the Raydium VersionedTransaction
    const txBuffer = Buffer.from(entry.transaction, "base64");
    const raydiumTx = VersionedTransaction.deserialize(txBuffer);

    // Resolve Address Lookup Tables for V0 message decompilation
    const altAccounts = await resolveAltAccounts(
      connection,
      raydiumTx.message,
    );
    if (altAccounts.length > 0) {
      console.log(`   Resolved ${altAccounts.length} ALT(s).`);
    }

    // Decompile the message to get individual instructions
    const decompiledMessage = TransactionMessage.decompile(
      raydiumTx.message,
      { addressLookupTableAccounts: altAccounts },
    );

    // Filter out ComputeBudget instructions (we add our own)
    const swapIxs = decompiledMessage.instructions.filter(
      (ix) => !isComputeBudgetIx(ix),
    );
    console.log(
      `   Extracted ${swapIxs.length} instruction(s) (excluding compute budget).`,
    );

    // Log each instruction's target program
    for (const ix of swapIxs) {
      console.log(
        `     -> ${ix.programId.toBase58()} (${ix.keys.length} accounts, ${ix.data.length} bytes data)`,
      );
    }

    // Wrap each instruction in Execute CPI
    const executeIxs = swapIxs.map((ix) =>
      wrapInExecuteCpi(ix, vaultStatePda, signer.publicKey, programId),
    );

    // Build new VersionedTransaction with our compute budget + wrapped instructions
    const allIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
      ...executeIxs,
    ];

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const messageV0 = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: blockhash,
      instructions: allIxs,
    }).compileToV0Message(
      altAccounts.length > 0 ? altAccounts : undefined,
    );

    const tx = new VersionedTransaction(messageV0);
    tx.sign([signer]);

    console.log("   Sending...");
    const sig = await connection.sendTransaction(tx, {
      skipPreflight: false,
    });
    await connection.confirmTransaction(sig, "confirmed");

    console.log(`   Confirmed: ${sig}`);
    console.log(
      `   Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`,
    );
  }

  console.log("\nPASSED — Raydium Swap CPI succeeded");
}

main().catch((error) => {
  console.error("\nFAILED:", error);
  process.exit(1);
});
