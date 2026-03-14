import cron from "node-cron";
import axios from "axios";
import { prisma } from "@repo/database";
import { logger } from "../utils/logger.js";
import { env } from "../utils/env.js";

const JUPITER_PRICE_URL = "https://api.jup.ag/price/v3";
const BATCH_SIZE = 100;
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface JupiterPriceData {
  [mint: string]: { usdPrice: number; decimals: number } | undefined;
}

/**
 * Fetch all token mints that need pricing (from Token table + vault holdings).
 */
async function getMintsToPrice(): Promise<string[]> {
  const tokens = await prisma.token.findMany({
    where: { isVault: false },
    select: { mint: true },
  });

  const mints = tokens.map((t) => t.mint);

  // Always include USDC
  if (!mints.includes(USDC_MINT)) {
    mints.push(USDC_MINT);
  }

  return mints;
}

/**
 * Filter mints for this instance (round-robin by index).
 */
function filterMintsForInstance(mints: string[]): string[] {
  const instanceId = env.PRICE_INSTANCE_ID;
  const totalInstances = env.PRICE_TOTAL_INSTANCES;

  if (totalInstances <= 1) return mints;

  return mints.filter((_, i) => i % totalInstances === instanceId);
}

/**
 * Fetch prices from Jupiter in batches of 100.
 */
async function fetchPricesFromJupiter(
  mints: string[],
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  // USDC is always $1.00
  prices.set(USDC_MINT, 1.0);

  const nonUsdcMints = mints.filter((m) => m !== USDC_MINT);

  for (let i = 0; i < nonUsdcMints.length; i += BATCH_SIZE) {
    const batch = nonUsdcMints.slice(i, i + BATCH_SIZE);
    const ids = batch.join(",");

    try {
      const { data } = await axios.get<JupiterPriceData>(JUPITER_PRICE_URL, {
        params: { ids },
        headers: { "x-api-key": env.JUPITER_API_KEY },
        timeout: 10_000,
      });

      for (const mint of batch) {
        const priceData = data[mint];
        if (priceData) {
          prices.set(mint, priceData.usdPrice);
        }
      }
    } catch (err) {
      logger.error(
        { err, batchStart: i, batchSize: batch.length },
        "Failed to fetch Jupiter prices for batch",
      );
    }

    // Rate limit: wait 1.1s between batches to stay under 60 req/min
    if (i + BATCH_SIZE < nonUsdcMints.length) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }

  return prices;
}

/**
 * Write prices to DB for each token.
 */
async function storePrices(prices: Map<string, number>): Promise<void> {
  for (const [mint, usdPrice] of prices) {
    try {
      const token = await prisma.token.findUnique({ where: { mint } });
      if (token) {
        await prisma.tokenPrice.create({
          data: { tokenId: token.id, usdPrice },
        });
      }
    } catch (err) {
      logger.error({ err, mint }, "Failed to store price for token");
    }
  }
}

/**
 * Main price fetch cycle.
 */
async function runPriceFetch(): Promise<void> {
  const startTime = Date.now();

  const allMints = await getMintsToPrice();
  const myMints = filterMintsForInstance(allMints);

  logger.info(
    {
      instanceId: env.PRICE_INSTANCE_ID,
      totalInstances: env.PRICE_TOTAL_INSTANCES,
      totalMints: allMints.length,
      myMints: myMints.length,
    },
    "Starting price fetch cycle",
  );

  const prices = await fetchPricesFromJupiter(myMints);
  await storePrices(prices);

  const elapsed = Date.now() - startTime;
  logger.info(
    { pricesStored: prices.size, elapsedMs: elapsed },
    "Price fetch cycle complete",
  );
}

// ── Entrypoint ─────────────────────────────────────────────────
logger.info(
  {
    instanceId: env.PRICE_INSTANCE_ID,
    totalInstances: env.PRICE_TOTAL_INSTANCES,
  },
  "Price worker starting",
);

// Run immediately on startup
runPriceFetch().catch((err) => {
  logger.error({ err }, "Initial price fetch failed");
});

// Then schedule every minute
cron.schedule(env.CRON_FETCH_PRICES, () => {
  runPriceFetch().catch((err) => {
    logger.error({ err }, "Price fetch cron failed");
  });
});

logger.info("Price worker cron scheduled");
