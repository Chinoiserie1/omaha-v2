import cron from "node-cron";
import axios from "axios";
import { prisma } from "@repo/database";
import { logger } from "../utils/logger.js";
import { env } from "../utils/env.js";
import { RateLimiter, Semaphore } from "../utils/rate-limiter.js";
import { bulkInsertPrices } from "../store/token-price.repository.js";

const JUPITER_PRICE_URL = "https://api.jup.ag/price/v3";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface JupiterPriceData {
  [mint: string]: { usdPrice: number; decimals: number } | undefined;
}

// ── API Key Setup ─────────────────────────────────────────────

interface ApiKeySlot {
  readonly key: string;
  readonly limiter: RateLimiter;
}

function buildApiKeySlots(): readonly ApiKeySlot[] {
  const keys = env.JUPITER_API_KEYS
    ? env.JUPITER_API_KEYS.split(",").map((k) => k.trim()).filter(Boolean)
    : [env.JUPITER_API_KEY];

  return keys.map((key) => ({
    key,
    limiter: new RateLimiter(env.JUPITER_RPM),
  }));
}

const apiKeySlots = buildApiKeySlots();
const semaphore = new Semaphore(env.PRICE_CONCURRENCY);

// ── Active Vault Mints ───────────────────────────────────────

async function getActiveVaultMints(): Promise<Set<string>> {
  const mints = new Set<string>();

  // Get mints from latest allocation of each active vault
  const allocationMints = await prisma.snapshotAllocation.findMany({
    where: {
      mint: { not: null },
      snapshot: {
        quant: {
          vault: { isActive: true },
        },
      },
    },
    distinct: ["mint"],
    select: { mint: true },
  });

  for (const row of allocationMints) {
    if (row.mint) mints.add(row.mint);
  }

  // Get mints from current holdings of each active vault
  const holdingMints = await prisma.snapshotHolding.findMany({
    where: {
      snapshot: {
        vault: { isActive: true },
        endDate: null,
      },
    },
    distinct: ["mint"],
    select: { mint: true },
  });

  for (const row of holdingMints) {
    mints.add(row.mint);
  }

  // Resolve unresolved allocation symbols to mints
  const unresolvedSymbols = await prisma.snapshotAllocation.findMany({
    where: {
      mint: null,
      snapshot: {
        quant: {
          vault: { isActive: true },
        },
      },
    },
    distinct: ["asset"],
    select: { asset: true },
  });

  if (unresolvedSymbols.length > 0) {
    const symbols = unresolvedSymbols.map((r) => r.asset);
    const resolved = await prisma.token.findMany({
      where: { symbol: { in: symbols } },
      select: { mint: true },
    });
    for (const t of resolved) {
      mints.add(t.mint);
    }
  }

  return mints;
}

// ── Mint Fetching ─────────────────────────────────────────────

interface MintData {
  readonly mints: string[];
  readonly mintToTokenId: Map<string, string>;
}

async function getMintsAndIdMap(): Promise<MintData> {
  const activeMints = await getActiveVaultMints();
  activeMints.add(USDC_MINT);

  const tokens = await prisma.token.findMany({
    where: { mint: { in: [...activeMints] } },
    select: { id: true, mint: true },
  });

  const mints = tokens.map((t) => t.mint);

  // Include any active mints that may not have Token records yet
  for (const m of activeMints) {
    if (!mints.includes(m)) {
      mints.push(m);
    }
  }

  if (!mints.includes(USDC_MINT)) {
    mints.push(USDC_MINT);
  }

  const mintToTokenId = new Map<string, string>();
  for (const t of tokens) {
    mintToTokenId.set(t.mint, t.id);
  }

  return { mints, mintToTokenId };
}

// ── Batch Fetching ────────────────────────────────────────────

function splitIntoBatches(mints: readonly string[]): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < mints.length; i += env.PRICE_BATCH_SIZE) {
    batches.push(mints.slice(i, i + env.PRICE_BATCH_SIZE));
  }
  return batches;
}

async function fetchBatch(
  batch: readonly string[],
  slot: ApiKeySlot,
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  await slot.limiter.acquire();

  const { data } = await axios.get<JupiterPriceData>(JUPITER_PRICE_URL, {
    params: { ids: batch.join(",") },
    headers: { "x-api-key": slot.key },
    timeout: 15_000,
  });

  for (const mint of batch) {
    const entry = data[mint];
    if (entry) {
      prices.set(mint, entry.usdPrice);
    }
  }

  return prices;
}

interface FetchResult {
  readonly prices: Map<string, number>;
  readonly failedBatches: number;
}

async function fetchAllPrices(mints: readonly string[]): Promise<FetchResult> {
  const prices = new Map<string, number>();

  // USDC is always $1.00
  prices.set(USDC_MINT, 1.0);

  const nonUsdc = mints.filter((m) => m !== USDC_MINT);
  if (nonUsdc.length === 0) return { prices, failedBatches: 0 };

  const batches = splitIntoBatches(nonUsdc);

  // Round-robin batch assignment across API key slots (static by index)
  const batchPromises = batches.map(async (batch, index) => {
    const slot = apiKeySlots[index % apiKeySlots.length]!;

    await semaphore.acquire();
    try {
      return await fetchBatch(batch, slot);
    } finally {
      semaphore.release();
    }
  });

  const results = await Promise.allSettled(batchPromises);

  let failedBatches = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const [mint, price] of result.value) {
        prices.set(mint, price);
      }
    } else {
      failedBatches += 1;
      logger.error(
        { err: result.reason },
        "Failed to fetch Jupiter prices for batch",
      );
    }
  }

  return { prices, failedBatches };
}

// ── Main Cycle ────────────────────────────────────────────────

let running = false;

async function runPriceFetch(): Promise<void> {
  if (running) {
    logger.warn("Price fetch cycle still running, skipping this schedule");
    return;
  }

  running = true;
  const startTime = Date.now();

  try {
    const { mints, mintToTokenId } = await getMintsAndIdMap();

    const nonUsdcCount = mints.filter((m) => m !== USDC_MINT).length;
    const batchCount = Math.ceil(nonUsdcCount / env.PRICE_BATCH_SIZE);

    logger.info(
      {
        totalMints: mints.length,
        batches: batchCount,
        apiKeys: apiKeySlots.length,
        concurrency: env.PRICE_CONCURRENCY,
        rpm: env.JUPITER_RPM,
        effectiveRpm: apiKeySlots.length * env.JUPITER_RPM,
      },
      "Starting price fetch cycle",
    );

    const { prices, failedBatches } = await fetchAllPrices(mints);
    const timestamp = new Date();
    const inserted = await bulkInsertPrices(prices, mintToTokenId, timestamp);

    const elapsed = Date.now() - startTime;
    logger.info(
      {
        pricesFetched: prices.size,
        pricesStored: inserted,
        failedBatches,
        elapsedMs: elapsed,
        elapsedSec: Math.round(elapsed / 1000),
      },
      "Price fetch cycle complete",
    );

    if (failedBatches > 0) {
      logger.warn(
        { failedBatches, totalBatches: batchCount },
        "Some price batches failed — stored partial data",
      );
    }
  } finally {
    running = false;
  }
}

// ── Entrypoint ────────────────────────────────────────────────

logger.info(
  {
    apiKeys: apiKeySlots.length,
    rpm: env.JUPITER_RPM,
    effectiveRpm: apiKeySlots.length * env.JUPITER_RPM,
    concurrency: env.PRICE_CONCURRENCY,
    batchSize: env.PRICE_BATCH_SIZE,
    cron: env.CRON_FETCH_PRICES,
  },
  "Price worker starting",
);

// Run immediately on startup
runPriceFetch().catch((err) => {
  logger.error({ err }, "Initial price fetch failed");
});

// Then schedule on cron
cron.schedule(env.CRON_FETCH_PRICES, () => {
  runPriceFetch().catch((err) => {
    logger.error({ err }, "Price fetch cron failed");
  });
});

// Graceful shutdown — clean up rate limiter timers
process.on("SIGTERM", () => {
  for (const slot of apiKeySlots) slot.limiter.destroy();
  process.exit(0);
});

logger.info("Price worker cron scheduled");
