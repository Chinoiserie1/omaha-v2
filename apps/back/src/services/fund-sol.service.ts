import axios from "axios";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { USDC_MINT, SOL_MINT, USDC_DECIMALS } from "../solana/config.js";
import { getJupiterQuote, validatePriceImpact } from "./jupiter-swap.service.js";
import {
  deserializeInstruction,
  type JupiterInstructionPayload,
} from "./jupiter-instruction.util.js";
import type { TransactionInstruction } from "@solana/web3.js";
import type { FundSolQuote } from "@repo/shared";

const JUPITER_API_BASE = "https://api.jup.ag/swap/v1";

export interface FundSolPlan {
  setupInstructions: TransactionInstruction[];
  swapInstruction: TransactionInstruction;
  cleanupInstruction: TransactionInstruction | null;
  quote: FundSolQuote;
}

export async function buildFundSolPlan(
  amountUsd: number,
  signerPublicKey: string,
): Promise<FundSolPlan> {
  const feePct = env.FUND_SOL_FEE_PCT;
  const platformFeeUsdc = amountUsd * (feePct / 100);
  const swapUsdc = amountUsd - platformFeeUsdc;

  // Convert USDC to lamports (6 decimals)
  const swapLamports = Math.round(swapUsdc * 10 ** USDC_DECIMALS).toString();

  // 1. Get Jupiter quote with higher slippage for small amounts
  const jupQuote = await getJupiterQuote(
    USDC_MINT.toBase58(),
    SOL_MINT.toBase58(),
    swapLamports,
    100, // 1% slippage for small swaps
  );

  // 2. Validate price impact
  if (!validatePriceImpact(jupQuote, env.MAX_PRICE_IMPACT_BPS)) {
    throw new Error(
      `Price impact too high: ${jupQuote["priceImpactPct"]}%`,
    );
  }

  // 3. Get swap instructions with user as the signer (NOT vault PDA)
  const { data } = await axios.post(
    `${JUPITER_API_BASE}/swap-instructions`,
    {
      quoteResponse: jupQuote,
      userPublicKey: signerPublicKey,
    },
    { headers: { "x-api-key": env.JUPITER_API_KEY } },
  );

  const setupPayloads: JupiterInstructionPayload[] =
    data.setupInstructions ?? [];
  const swapPayload: JupiterInstructionPayload = data.swapInstruction;
  const cleanupPayload: JupiterInstructionPayload | null =
    data.cleanupInstruction ?? null;

  // 4. Deserialize all instructions
  const setupInstructions = setupPayloads.map(deserializeInstruction);
  const swapInstruction = deserializeInstruction(swapPayload);
  const cleanupInstruction = cleanupPayload
    ? deserializeInstruction(cleanupPayload)
    : null;

  // 5. Build quote info
  const outputAmountSol =
    Number(jupQuote["outAmount"]) / 10 ** 9; // SOL has 9 decimals

  const quote: FundSolQuote = {
    amountUsd,
    inputAmountUsdc: swapUsdc,
    outputAmountSol,
    platformFeeUsdc,
    platformFeePct: feePct,
  };

  logger.info(
    { amountUsd, swapUsdc, platformFeeUsdc, outputAmountSol },
    "Fund SOL plan built",
  );

  return { setupInstructions, swapInstruction, cleanupInstruction, quote };
}
