import axios from "axios";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import * as priceRepo from "../store/price.repository.js";
import { findAssetBySymbol } from "../store/asset.repository.js";

const STABLECOINS = new Set(["USDC", "USDT", "DAI", "BUSD", "PYUSD"]);

const BIRDEYE_BASE = "https://public-api.birdeye.so";

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch daily OHLCV from Birdeye for a Solana token (by mint address)
 * and store each day's close price.
 */
export async function fetchAndStorePrices(
  symbol: string,
  from: Date,
  to: Date
): Promise<number> {
  const asset = await findAssetBySymbol(symbol);
  if (!asset) {
    logger.warn({ symbol }, "Asset not found in TradeableAsset, skipping price fetch");
    return 0;
  }

  const fromTs = Math.floor(from.getTime() / 1000);
  const toTs = Math.floor(to.getTime() / 1000);

  let data: Array<{ unixTime: number; value: number }>;
  try {
    const resp = await axios.get(`${BIRDEYE_BASE}/defi/history_price`, {
      params: {
        address: asset.mint,
        address_type: "token",
        type: "1D",
        time_from: fromTs,
        time_to: toTs,
      },
      headers: {
        "X-API-KEY": env.BIRDEYE_API_KEY,
        accept: "application/json",
      },
    });
    data = resp.data?.data?.items ?? [];
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      logger.warn({ symbol }, "Birdeye rate limited, retrying in 5s");
      await sleep(5000);
      const resp = await axios.get(`${BIRDEYE_BASE}/defi/history_price`, {
        params: {
          address: asset.mint,
          address_type: "token",
          type: "1D",
          time_from: fromTs,
          time_to: toTs,
        },
        headers: {
          "X-API-KEY": env.BIRDEYE_API_KEY,
          accept: "application/json",
        },
      });
      data = resp.data?.data?.items ?? [];
    } else {
      throw err;
    }
  }

  let stored = 0;
  for (const item of data) {
    const date = toDateOnly(new Date(item.unixTime * 1000));
    await priceRepo.upsertDailyPrice({
      symbol,
      date,
      priceUsd: item.value,
      source: "birdeye",
    });
    stored++;
  }

  logger.info({ symbol, stored, from: from.toISOString(), to: to.toISOString() }, "Stored Birdeye prices");
  return stored;
}

/**
 * Fetch S&P 500 daily prices from Yahoo Finance.
 */
export async function fetchAndStoreSP500Prices(
  from: Date,
  to: Date
): Promise<number> {
  const period1 = Math.floor(from.getTime() / 1000);
  const period2 = Math.floor(to.getTime() / 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${period1}&period2=${period2}&interval=1d`;

  const resp = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  const result = resp.data?.chart?.result?.[0];
  if (!result) {
    logger.warn("No S&P 500 data returned from Yahoo Finance");
    return 0;
  }

  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

  let stored = 0;
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;

    const date = toDateOnly(new Date(timestamps[i]! * 1000));
    await priceRepo.upsertDailyPrice({
      symbol: "SPX",
      date,
      priceUsd: close,
      source: "yahoo",
    });
    stored++;
  }

  logger.info({ stored, from: from.toISOString(), to: to.toISOString() }, "Stored S&P 500 prices");
  return stored;
}

/**
 * Ensure prices exist for a list of symbols over a date range.
 * Skips stablecoins and checks DB cache before fetching.
 */
export async function ensurePricesForSymbols(
  symbols: string[],
  from: Date,
  to: Date
): Promise<void> {
  const uniqueSymbols = [...new Set(symbols)].filter((s) => !STABLECOINS.has(s));

  const endDate = toDateOnly(to);

  for (const symbol of uniqueSymbols) {
    if (symbol === "SPX") {
      const hasEndDate = await priceRepo.findPriceOnDate("SPX", endDate);
      if (!hasEndDate) {
        await fetchAndStoreSP500Prices(from, to);
      }
      continue;
    }

    const hasEndDate = await priceRepo.findPriceOnDate(symbol, endDate);
    if (hasEndDate) {
      logger.debug({ symbol, date: endDate.toISOString() }, "End-date price cached, skipping fetch");
      continue;
    }

    try {
      await fetchAndStorePrices(symbol, from, to);
    } catch (err) {
      logger.warn({ err, symbol }, "Failed to fetch prices for symbol");
    }

    // Rate limit: 500ms between Birdeye calls
    await sleep(500);
  }
}

export interface PriceResult {
  price: number;
  date: Date;
  isFallback: boolean;
}

/**
 * Get the USD price for a symbol on a given date.
 * Stablecoins return $1. Others look up from DB (with near-date fallback).
 */
export async function getPriceOnDate(
  symbol: string,
  date: Date
): Promise<PriceResult | null> {
  if (STABLECOINS.has(symbol)) return { price: 1, date, isFallback: false };

  const dateOnly = toDateOnly(date);
  const exact = await priceRepo.findPriceOnDate(symbol, dateOnly);
  if (exact) return { price: exact.priceUsd, date: exact.date, isFallback: false };

  const near = await priceRepo.findPriceNearDate(symbol, dateOnly);
  if (near) return { price: near.priceUsd, date: near.date, isFallback: true };

  return null;
}
