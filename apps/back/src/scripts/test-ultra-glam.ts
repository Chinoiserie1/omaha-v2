/**
 * Test: Can we feed Ultra API's JupiterZ instruction into GLAM SDK's jupiterSwap?
 *
 * Approach:
 * 1. Get Ultra order → deserialize tx → extract JupiterZ instruction
 * 2. Convert to GLAM's SwapInstructions format
 * 3. Call glamClient.jupiterSwap.txBuilder.swapIxs() with it
 * 4. See if the GLAM on-chain program accepts it (build tx, don't send)
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm --filter @repo/back exec tsx src/scripts/test-ultra-glam.ts
 */

import {
  VersionedTransaction,
  Connection,
  type AddressLookupTableAccount,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PLTRON_MINT = "HfsnTS5qtdStwec9DfBrunRqnAMYMMz1kjv9Hu9ondo";
const PLTRX_MINT = "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4";

const JUPITER_API_KEY = process.env["JUPITER_API_KEY"];
if (!JUPITER_API_KEY) {
  console.error("Missing JUPITER_API_KEY");
  process.exit(1);
}

function getKeeperKeypair(): Keypair {
  const raw = process.env["KEEPER_PRIVATE_KEY"];
  if (!raw) {
    console.error("Missing KEEPER_PRIVATE_KEY");
    process.exit(1);
  }
  const bytes = (() => {
    try { return Uint8Array.from(JSON.parse(raw)); } catch { /* ignore */ }
    try { return bs58.decode(raw); } catch { /* ignore */ }
    return Buffer.from(raw, "base64");
  })();
  return bytes.length === 64 ? Keypair.fromSecretKey(bytes) : Keypair.fromSeed(bytes);
}

const RPC_URL = process.env["SOLANA_RPC_URL"] || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL);
const BASE = "https://api.jup.ag";
const headers = { "x-api-key": JUPITER_API_KEY! };

// Known programs
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

interface JupiterInstruction {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
}

interface SwapInstructions {
  computeBudgetInstructions: JupiterInstruction[];
  setupInstructions: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction?: JupiterInstruction;
  addressLookupTableAddresses: string[];
}

async function resolveALTs(tx: VersionedTransaction): Promise<AddressLookupTableAccount[]> {
  const message = tx.message;
  if (!("addressTableLookups" in message) || message.addressTableLookups.length === 0) {
    return [];
  }
  const alts: AddressLookupTableAccount[] = [];
  for (const lookup of message.addressTableLookups) {
    const result = await connection.getAddressLookupTable(lookup.accountKey);
    if (result.value) alts.push(result.value);
  }
  return alts;
}

function txIxToJupiterInstruction(
  tx: VersionedTransaction,
  ixIndex: number,
  accountKeys: ReturnType<typeof tx.message.getAccountKeys>,
): JupiterInstruction {
  const compiled = tx.message.compiledInstructions[ixIndex]!;
  const programId = accountKeys.get(compiled.programIdIndex)!.toBase58();

  const accounts = compiled.accountKeyIndexes.map((keyIdx) => {
    const pubkey = accountKeys.get(keyIdx)!.toBase58();
    const isSigner = keyIdx < tx.message.header.numRequiredSignatures;
    const numReadonly = tx.message.header.numReadonlySignedAccounts + tx.message.header.numReadonlyUnsignedAccounts;
    const totalKeys = accountKeys.length;
    const isWritable = keyIdx < (totalKeys - numReadonly);
    return { pubkey, isSigner, isWritable };
  });

  const data = Buffer.from(compiled.data).toString("base64");
  return { programId, accounts, data };
}

async function getUltraSwapInstructions(taker: string): Promise<{ swapInstructions: SwapInstructions; ultraMeta: Record<string, unknown> } | null> {
  const pairs = [
    { name: "USDC→PLTRon (Ondo)", outputMint: PLTRON_MINT, amount: "10000000" },
    { name: "USDC→PLTRx (xStock)", outputMint: PLTRX_MINT, amount: "10000000" },
  ];

  for (const pair of pairs) {
    console.log(`\n--- Ultra: ${pair.name} ---`);

    const params = new URLSearchParams({
      inputMint: USDC_MINT,
      outputMint: pair.outputMint,
      amount: pair.amount,
      taker,
    });

    const res = await fetch(`${BASE}/ultra/v1/order?${params}`, { headers });
    if (!res.ok) {
      console.error(`  Error ${res.status}: ${await res.text()}`);
      continue;
    }

    const data = (await res.json()) as Record<string, unknown>;
    console.log(`  swapType=${data["swapType"]} router=${data["router"]} in=${data["inAmount"]} out=${data["outAmount"]}`);

    if (!data["transaction"]) {
      console.error(`  No tx: [${data["errorCode"]}] ${data["errorMessage"] || data["error"]}`);
      continue;
    }

    const txBytes = Buffer.from(data["transaction"] as string, "base64");
    const tx = VersionedTransaction.deserialize(txBytes);
    const altAccounts = await resolveALTs(tx);
    const accountKeys = tx.message.getAccountKeys({ addressLookupTableAccounts: altAccounts });

    console.log(`  ${tx.message.compiledInstructions.length} instructions:`);

    const computeBudgetInstructions: JupiterInstruction[] = [];
    const setupInstructions: JupiterInstruction[] = [];
    let swapInstruction: JupiterInstruction | null = null;

    for (let i = 0; i < tx.message.compiledInstructions.length; i++) {
      const compiled = tx.message.compiledInstructions[i]!;
      const programId = accountKeys.get(compiled.programIdIndex)!.toBase58();
      console.log(`    ix[${i}] ${programId}`);

      const jupIx = txIxToJupiterInstruction(tx, i, accountKeys);

      if (programId === COMPUTE_BUDGET) {
        computeBudgetInstructions.push(jupIx);
      } else if (programId === ATA_PROGRAM) {
        setupInstructions.push(jupIx);
      } else {
        // This should be the JupiterZ swap instruction
        swapInstruction = jupIx;
        console.log(`    ^ SWAP instruction (${jupIx.accounts.length} accounts)`);
      }
    }

    if (!swapInstruction) {
      console.error("  Could not identify swap instruction");
      continue;
    }

    // Extract ALT addresses from the transaction
    const message = tx.message;
    const altAddresses: string[] = [];
    if ("addressTableLookups" in message) {
      for (const lookup of message.addressTableLookups) {
        altAddresses.push(lookup.accountKey.toBase58());
      }
    }

    return {
      swapInstructions: {
        computeBudgetInstructions,
        setupInstructions,
        swapInstruction,
        addressLookupTableAddresses: altAddresses,
      },
      ultraMeta: {
        swapType: data["swapType"],
        router: data["router"],
        inputMint: data["inputMint"],
        outputMint: data["outputMint"],
        inAmount: data["inAmount"],
        outAmount: data["outAmount"],
      },
    };
  }

  return null;
}

async function testGlamSwapIxs(swapInstructions: SwapInstructions, ultraMeta: Record<string, unknown>) {
  console.log("\n=== Testing GLAM SDK with Ultra's swap instruction ===\n");

  // Dynamic import to avoid startup crash if GLAM SDK isn't configured
  const { GlamClient } = await import("@glamsystems/glam-sdk");

  const keeper = getKeeperKeypair();
  const glamStatePda = new PublicKey(process.env["GLAM_STATE_PDA"] || "");
  if (!process.env["GLAM_STATE_PDA"]) {
    console.error("Missing GLAM_STATE_PDA — set it to test GLAM wrapping");
    console.log("\nSkipping GLAM test. But here's the extracted SwapInstructions:");
    console.log(JSON.stringify({
      swapInstruction: {
        programId: swapInstructions.swapInstruction.programId,
        accountCount: swapInstructions.swapInstruction.accounts.length,
        dataLength: swapInstructions.swapInstruction.data.length,
      },
      computeBudgetCount: swapInstructions.computeBudgetInstructions.length,
      setupCount: swapInstructions.setupInstructions.length,
      altCount: swapInstructions.addressLookupTableAddresses.length,
    }, null, 2));
    return;
  }

  try {
    // Initialize GLAM client
    // Note: GlamClient constructor varies — this is a best-effort attempt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const glamClient = new GlamClient({
      statePda: glamStatePda,
      signer: keeper,
      connection,
      jupiterApiKey: JUPITER_API_KEY,
    } as any);

    const inputMint = String(ultraMeta["inputMint"]);
    const outputMint = String(ultraMeta["outputMint"]);

    // Try to build swap instructions through GLAM
    const [ixs, lookupTables] = await glamClient.jupiterSwap.txBuilder.swapIxs(
      {
        quoteParams: {
          inputMint,
          outputMint,
          amount: Number(ultraMeta["inAmount"]),
          instructionVersion: "V1" as const,
        },
        swapInstructions,
      },
      keeper.publicKey,
    );

    console.log("GLAM accepted the swap instructions!");
    console.log(`  Generated ${ixs.length} GLAM instructions`);
    console.log(`  ${lookupTables.length} lookup tables`);

    for (let i = 0; i < ixs.length; i++) {
      console.log(`  ix[${i}] programId: ${ixs[i]!.programId.toBase58()}`);
    }
  } catch (err: any) {
    console.error("GLAM rejected the swap instructions:");
    console.error(`  ${err.message || err}`);
    if (err.logs) {
      console.error("  Logs:", err.logs.slice(-5));
    }
  }
}

async function main() {
  const keeper = getKeeperKeypair();
  const taker = keeper.publicKey.toBase58();

  console.log("=== Ultra → GLAM Workaround Test ===");
  console.log(`Taker: ${taker}`);

  const result = await getUltraSwapInstructions(taker);

  if (!result) {
    console.error("\nFailed to get Ultra swap instructions. Try during market hours.");
    return;
  }

  console.log("\nExtracted SwapInstructions from Ultra transaction:");
  console.log(`  swap programId: ${result.swapInstructions.swapInstruction.programId}`);
  console.log(`  swap accounts: ${result.swapInstructions.swapInstruction.accounts.length}`);
  console.log(`  compute budget ixs: ${result.swapInstructions.computeBudgetInstructions.length}`);
  console.log(`  setup ixs: ${result.swapInstructions.setupInstructions.length}`);
  console.log(`  ALTs: ${result.swapInstructions.addressLookupTableAddresses.length}`);

  await testGlamSwapIxs(result.swapInstructions, result.ultraMeta);
}

main().catch(console.error);
