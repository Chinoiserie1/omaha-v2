import axios from "axios";
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { deriveVaultPda } from "../solana/config.js";
import { wrapForGlam } from "../solana/mapper.js";
import { buildAndSendVersionedTx } from "../solana/tx.js";
import {
  deserializeInstruction,
  type JupiterInstructionPayload,
} from "./jupiter-instruction.util.js";

const JUPITER_API_BASE = "https://api.jup.ag/swap/v1";

// ── Quote ──────────────────────────────────────────────────────

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: string,
  slippageBps = 50
): Promise<Record<string, unknown>> {
  const { data } = await axios.get(`${JUPITER_API_BASE}/quote`, {
    params: {
      inputMint,
      outputMint,
      amount: amountLamports,
      slippageBps,
    },
    headers: { "x-api-key": env.JUPITER_API_KEY },
  });

  logger.debug(
    {
      inputMint,
      outputMint,
      inAmount: data.inAmount,
      outAmount: data.outAmount,
      priceImpactPct: data.priceImpactPct,
    },
    "Jupiter quote received"
  );

  return data;
}

// ── Swap Instructions ──────────────────────────────────────────

async function getJupiterSwapInstructions(
  quoteResponse: Record<string, unknown>,
  vaultStatePda: PublicKey
): Promise<{
  setupInstructions: JupiterInstructionPayload[];
  swapInstruction: JupiterInstructionPayload;
  cleanupInstruction: JupiterInstructionPayload | null;
  addressLookupTableAddresses: string[];
}> {
  const vaultPda = deriveVaultPda(vaultStatePda);

  const { data } = await axios.post(
    `${JUPITER_API_BASE}/swap-instructions`,
    {
      quoteResponse,
      userPublicKey: vaultPda.toBase58(),
    },
    { headers: { "x-api-key": env.JUPITER_API_KEY } }
  );

  return {
    setupInstructions: data.setupInstructions ?? [],
    swapInstruction: data.swapInstruction,
    cleanupInstruction: data.cleanupInstruction ?? null,
    addressLookupTableAddresses: data.addressLookupTableAddresses ?? [],
  };
}

// ── Price Impact Validation ────────────────────────────────────

export function validatePriceImpact(
  quote: Record<string, unknown>,
  maxBps: number
): boolean {
  const impactPct = parseFloat(String(quote["priceImpactPct"] ?? "0"));
  const impactBps = impactPct * 100;
  if (impactBps > maxBps) {
    logger.warn(
      { impactBps, maxBps },
      "Price impact exceeds maximum threshold"
    );
    return false;
  }
  return true;
}

// ── Execute Swap ───────────────────────────────────────────────

export async function executeJupiterSwap(
  vaultStatePda: PublicKey,
  inputMint: string,
  outputMint: string,
  amountLamports: string,
  slippageBps = 50
): Promise<string> {
  // 1. Get quote
  const quote = await getJupiterQuote(
    inputMint,
    outputMint,
    amountLamports,
    slippageBps
  );

  // 2. Validate price impact
  if (!validatePriceImpact(quote, env.MAX_PRICE_IMPACT_BPS)) {
    throw new Error(
      `Price impact too high: ${quote["priceImpactPct"]}% (max ${env.MAX_PRICE_IMPACT_BPS / 100}%)`
    );
  }

  // 3. Get swap instructions
  const {
    setupInstructions,
    swapInstruction,
    cleanupInstruction,
    addressLookupTableAddresses,
  } = await getJupiterSwapInstructions(quote, vaultStatePda);

  // 4. Build instruction list
  const instructions: TransactionInstruction[] = [];

  // Setup: deserialize but do NOT map (standard SPL instructions)
  for (const ix of setupInstructions) {
    instructions.push(deserializeInstruction(ix));
  }

  // Swap: deserialize AND map through ix-mapper (Jupiter program IX)
  const rawSwapIx = deserializeInstruction(swapInstruction);
  instructions.push(wrapForGlam(rawSwapIx, vaultStatePda));

  // Cleanup: deserialize but do NOT map (standard SPL, e.g. SOL unwrap)
  if (cleanupInstruction) {
    instructions.push(deserializeInstruction(cleanupInstruction));
  }

  // 5. Build versioned tx with ALT support, sign, send, confirm
  const description = `Jupiter swap ${inputMint.slice(0, 8)}→${outputMint.slice(0, 8)}`;
  const txSig = await buildAndSendVersionedTx(
    instructions,
    description,
    addressLookupTableAddresses
  );

  logger.info(
    { txSig, inputMint, outputMint, amount: amountLamports },
    "Jupiter swap executed"
  );

  return txSig;
}
