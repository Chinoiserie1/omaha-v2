import axios from "axios";
import type { PublicKey } from "@solana/web3.js";
import type { QuoteResponse } from "@glamsystems/glam-sdk";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { getGlamClient } from "../solana/client.js";

const JUPITER_API_BASE = "https://api.jup.ag/swap/v1";

// ── Quote ──────────────────────────────────────────────────────

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: string,
  slippageBps = 50
): Promise<QuoteResponse> {
  const { data } = await axios.get<QuoteResponse>(
    `${JUPITER_API_BASE}/quote`,
    {
      params: {
        inputMint,
        outputMint,
        amount: amountLamports,
        slippageBps,
      },
      headers: { "x-api-key": env.JUPITER_API_KEY },
    }
  );

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

// ── Price Impact Validation ────────────────────────────────────

export function validatePriceImpact(
  quote: QuoteResponse,
  maxBps: number
): boolean {
  const impactPct = parseFloat(String(quote.priceImpactPct ?? "0"));
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
      `Price impact too high: ${quote.priceImpactPct}% (max ${env.MAX_PRICE_IMPACT_BPS / 100}%)`
    );
  }

  // 3. Use GLAM SDK's jupiterSwap — handles CPI wrapping internally
  const client = getGlamClient(vaultStatePda);
  const txSig = await client.jupiterSwap.swap({
    quoteResponse: quote,
  });

  logger.info(
    { txSig, inputMint, outputMint, amount: amountLamports },
    "Jupiter swap executed via GLAM SDK"
  );

  return txSig;
}
