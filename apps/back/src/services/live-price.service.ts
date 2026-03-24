import axios from "axios";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";

const JUPITER_PRICE_URL = "https://api.jup.ag/price/v3";
const BIRDEYE_PRICE_URL = "https://public-api.birdeye.so/defi/multi_price";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface JupiterPriceData {
  [mint: string]: { usdPrice: number } | undefined;
}

interface BirdeyePriceResponse {
  data: Record<string, { value: number } | undefined>;
}

/**
 * Fetch live prices from Jupiter Price API (primary source).
 */
export async function fetchJupiterPrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  try {
    const { data } = await axios.get<JupiterPriceData>(JUPITER_PRICE_URL, {
      params: { ids: mints.join(",") },
      headers: { "x-api-key": env.JUPITER_API_KEY },
      timeout: 10_000,
    });
    for (const mint of mints) {
      const entry = data[mint];
      if (entry) prices.set(mint, entry.usdPrice);
    }
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : err },
      "Jupiter price fetch failed, will try Birdeye",
    );
  }
  return prices;
}

/**
 * Fetch live prices from Birdeye (fallback for mints Jupiter missed).
 */
export async function fetchBirdeyePrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (!env.BIRDEYE_API_KEY || mints.length === 0) return prices;

  try {
    const { data } = await axios.get<BirdeyePriceResponse>(BIRDEYE_PRICE_URL, {
      params: { list_address: mints.join(",") },
      headers: {
        "X-API-KEY": env.BIRDEYE_API_KEY,
        accept: "application/json",
      },
      timeout: 10_000,
    });
    for (const mint of mints) {
      const entry = data.data?.[mint];
      if (entry) prices.set(mint, entry.value);
    }
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : err },
      "Birdeye price fetch failed",
    );
  }
  return prices;
}

/**
 * Fetch live prices from multiple sources: Jupiter (primary) → Birdeye (fallback).
 * USDC is hardcoded to $1.
 */
export async function fetchLivePrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  prices.set(USDC_MINT, 1.0);

  const nonUsdc = mints.filter((m) => m !== USDC_MINT);
  if (nonUsdc.length === 0) return prices;

  // Primary: Jupiter
  const jupPrices = await fetchJupiterPrices(nonUsdc);
  for (const [mint, price] of jupPrices) {
    prices.set(mint, price);
  }

  // Fallback: Birdeye for missing mints
  const missing = nonUsdc.filter((m) => !prices.has(m));
  if (missing.length > 0) {
    logger.info(
      { missing: missing.length },
      "Fetching missing prices from Birdeye",
    );
    const birdeyePrices = await fetchBirdeyePrices(missing);
    for (const [mint, price] of birdeyePrices) {
      prices.set(mint, price);
    }
  }

  return prices;
}
