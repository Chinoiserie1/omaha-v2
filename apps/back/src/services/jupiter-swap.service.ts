import axios from "axios";
import {
  PublicKey,
  TransactionInstruction as TxInstruction,
  type TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js";
import { createExecuteInstruction } from "@repo/omaha-programs-sdk";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { getAdmin } from "../solana/config.js";
import { buildAndSendVersionedTx } from "../solana/tx.js";

const JUPITER_API_BASE = "https://api.jup.ag/swap/v1";

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
  contextSlot?: number;
  timeTaken?: number;
}

interface SwapInstructionsResponse {
  setupInstructions: SerializedInstruction[];
  swapInstruction: SerializedInstruction;
  cleanupInstruction: SerializedInstruction | null;
  addressLookupTableAddresses: string[];
}

interface SerializedInstruction {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string; // base64
}

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
        // When JUPITER_MAX_ACCOUNTS > 0, allow multi-hop routes up to that account limit.
        // Otherwise, force single-hop (direct routes only).
        ...(env.JUPITER_MAX_ACCOUNTS > 0
          ? { maxAccounts: env.JUPITER_MAX_ACCOUNTS }
          : { onlyDirectRoutes: true }),
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

// ── Deserialize Jupiter instruction ────────────────────────────

function deserializeInstruction(
  ix: SerializedInstruction,
): TransactionInstruction {
  return new TxInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((a) => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  });
}

// ── Get Jupiter swap instructions ──────────────────────────────

async function getJupiterSwapInstructions(
  quote: QuoteResponse,
  vaultStatePda: PublicKey,
): Promise<SwapInstructionsResponse> {
  const { data } = await axios.post<SwapInstructionsResponse>(
    `${JUPITER_API_BASE}/swap-instructions`,
    {
      quoteResponse: quote,
      userPublicKey: vaultStatePda.toBase58(),
    },
    {
      headers: { "x-api-key": env.JUPITER_API_KEY },
    },
  );

  return data;
}

// ── Wrap instruction in Execute CPI ────────────────────────────

function wrapInExecuteCpi(
  jupIx: TransactionInstruction,
  vaultStatePda: PublicKey,
  operator: PublicKey,
): TransactionInstruction {
  // Convert Jupiter ix accounts to remaining accounts for Execute CPI
  // The vault PDA will sign on behalf of itself during CPI
  const remainingAccounts: AccountMeta[] = jupIx.keys.map((key) => ({
    pubkey: key.pubkey,
    isSigner: false, // vault PDA signs via CPI, not directly
    isWritable: key.isWritable,
  }));

  return createExecuteInstruction({
    operator,
    vaultState: vaultStatePda,
    targetProgram: jupIx.programId,
    remainingAccounts,
    targetInstructionData: jupIx.data as Buffer,
  });
}

// ── Execute Swap ───────────────────────────────────────────────

export async function executeJupiterSwap(
  vaultStatePda: PublicKey,
  inputMint: string,
  outputMint: string,
  amountLamports: string,
  slippageBps = 50
): Promise<string> {
  const admin = getAdmin();

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

  // 3. Get Jupiter swap instructions (individual instructions, not a transaction)
  const swapIxs = await getJupiterSwapInstructions(quote, vaultStatePda);

  // 4. Build transaction instructions
  const executeIxs: TransactionInstruction[] = [];

  // Setup instructions (e.g., create ATAs) — execute directly, NOT via Execute CPI.
  // The vault PDA carries state data so the System program rejects it as a rent payer.
  // Replace vault PDA (signer) with admin as payer; keep vault PDA as ATA owner.
  for (const setupIx of swapIxs.setupInstructions) {
    const ix = deserializeInstruction(setupIx);
    const fixedKeys = ix.keys.map((key) =>
      key.pubkey.equals(vaultStatePda) && key.isSigner
        ? { ...key, pubkey: admin.publicKey }
        : key,
    );
    executeIxs.push(
      new TxInstruction({ programId: ix.programId, keys: fixedKeys, data: ix.data }),
    );
  }

  // Main swap instruction — wrapped in Execute CPI (vault PDA signs via invoke_signed)
  const mainIx = deserializeInstruction(swapIxs.swapInstruction);
  executeIxs.push(wrapInExecuteCpi(mainIx, vaultStatePda, admin.publicKey));

  // Cleanup instruction (if any)
  if (swapIxs.cleanupInstruction) {
    const cleanupIx = deserializeInstruction(swapIxs.cleanupInstruction);
    executeIxs.push(wrapInExecuteCpi(cleanupIx, vaultStatePda, admin.publicKey));
  }

  // 5. Build, sign, and send via versioned tx with ALTs
  const txSig = await buildAndSendVersionedTx(
    executeIxs,
    `Jupiter swap ${inputMint.slice(0, 8)} → ${outputMint.slice(0, 8)}`,
    swapIxs.addressLookupTableAddresses,
  );

  logger.info(
    { txSig, inputMint, outputMint, amount: amountLamports },
    "Jupiter swap executed via Execute CPI",
  );

  return txSig;
}
