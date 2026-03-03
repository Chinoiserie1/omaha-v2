import type { PortfolioSnapshot, Prisma } from "@repo/database";
import { logger } from "../utils/logger.js";
import * as portfolioRepo from "../store/portfolio.repository.js";
import * as perfRepo from "../store/performance.repository.js";
import { ensurePricesForSymbols, getPriceOnDate } from "./price.service.js";

interface Allocation {
  asset: string;
  percentage: number;
  [key: string]: unknown;
}

interface PeriodResult {
  fromSnapshotId: string;
  toSnapshotId: string;
  fromDate: string;
  toDate: string;
  periodReturn: number;
  cumulativeValue: number;
  periodDays: number;
  details: Record<string, { weight: number; priceFrom: number | null; priceTo: number | null; assetReturn: number }>;
}

export interface BacktestResult {
  kolId: string;
  snapshotCount: number;
  periods: PeriodResult[];
  totalReturn: number;
  latestCumulativeValue: number;
}

function parseAllocations(snapshot: PortfolioSnapshot): Allocation[] {
  const raw = snapshot.allocations;
  if (Array.isArray(raw)) return raw as Allocation[];
  return [];
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function deduplicateByDay(snapshots: PortfolioSnapshot[]): PortfolioSnapshot[] {
  const byDay = new Map<string, PortfolioSnapshot>();
  for (const snap of snapshots) {
    byDay.set(toDateKey(snap.createdAt), snap); // last snapshot of the day wins
  }
  return [...byDay.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Compute the return for a single period between two consecutive snapshots.
 * Uses the "from" snapshot's allocations and prices at both dates.
 */
async function computePeriod(
  current: PortfolioSnapshot,
  next: PortfolioSnapshot,
  prevCumulativeValue: number
): Promise<PeriodResult> {
  const allocations = parseAllocations(current);
  const fromDate = current.createdAt;
  const toDate = next.createdAt;

  const totalPct = allocations.reduce((sum, a) => sum + a.percentage, 0);
  if (Math.abs(totalPct - 100) > 1) {
    logger.warn(
      { snapshotId: current.id, totalPct, assets: allocations.map((a) => `${a.asset}:${a.percentage}%`) },
      "Allocation percentages do not sum to 100%"
    );
  }

  let periodReturn = 0;
  const details: PeriodResult["details"] = {};

  for (const alloc of allocations) {
    const weight = alloc.percentage / 100;
    const priceFromResult = await getPriceOnDate(alloc.asset, fromDate);
    const priceToResult = await getPriceOnDate(alloc.asset, toDate);

    const priceFrom = priceFromResult?.price ?? null;
    const priceTo = priceToResult?.price ?? null;

    if (!priceFrom || !priceTo) {
      logger.warn(
        { symbol: alloc.asset, fromDate: fromDate.toISOString(), toDate: toDate.toISOString(), priceFrom, priceTo },
        "Missing price for asset, treating as 0% return"
      );
    }

    if (priceFromResult && priceToResult &&
        priceFromResult.date.getTime() === priceToResult.date.getTime()) {
      logger.warn(
        { symbol: alloc.asset, resolvedDate: priceFromResult.date.toISOString() },
        "Both from/to prices resolved to same date (missing price data)"
      );
    }

    let assetReturn = 0;
    if (priceFrom && priceTo && priceFrom > 0) {
      assetReturn = (priceTo - priceFrom) / priceFrom;
    }

    periodReturn += weight * assetReturn;

    details[alloc.asset] = {
      weight,
      priceFrom,
      priceTo,
      assetReturn,
    };
  }

  const cumulativeValue = prevCumulativeValue * (1 + periodReturn);

  return {
    fromSnapshotId: current.id,
    toSnapshotId: next.id,
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    periodReturn,
    cumulativeValue,
    periodDays: daysBetween(fromDate, toDate),
    details,
  };
}

/**
 * Auto-compute: called after thesis cron creates a new snapshot.
 * Stores one SnapshotPerformance row for the latest period.
 */
export async function computeLatestPeriod(kolId: string): Promise<void> {
  const snapshots = await portfolioRepo.findSnapshotHistory(kolId, 2);
  if (snapshots.length < 2) {
    logger.debug({ kolId }, "Need at least 2 snapshots to compute period performance");
    return;
  }

  // snapshots are ordered desc, so [0] is newest, [1] is previous
  const current = snapshots[1]!;
  const next = snapshots[0]!;

  // Skip same-day pairs — daily price granularity would produce 0% return
  if (toDateKey(current.createdAt) === toDateKey(next.createdAt)) {
    logger.debug({ kolId }, "Latest snapshots are same-day, skipping period computation");
    return;
  }

  // Check if already computed
  const existing = await perfRepo.findBySnapshotPair(current.id, next.id);
  if (existing) {
    logger.debug({ kolId }, "Period performance already computed");
    return;
  }

  // Collect all symbols we need prices for
  const allocations = parseAllocations(current);
  const symbols = allocations.map((a) => a.asset);

  // Ensure prices are fetched
  const fromDate = new Date(current.createdAt.getTime() - 24 * 60 * 60 * 1000);
  const toDate = new Date(next.createdAt.getTime() + 24 * 60 * 60 * 1000);
  await ensurePricesForSymbols(symbols, fromDate, toDate);

  // Get previous cumulative value
  const latestPerf = await perfRepo.findLatestByKol(kolId);
  const prevCumulativeValue = latestPerf?.cumulativeValue ?? 1;

  const result = await computePeriod(current, next, prevCumulativeValue);

  await perfRepo.upsert({
    kolId,
    fromSnapshotId: result.fromSnapshotId,
    toSnapshotId: result.toSnapshotId,
    periodReturn: result.periodReturn,
    cumulativeValue: result.cumulativeValue,
    periodDays: result.periodDays,
    details: result.details as unknown as Prisma.InputJsonValue,
  });

  logger.info(
    { kolId, periodReturn: result.periodReturn, cumulativeValue: result.cumulativeValue },
    "Stored period performance"
  );
}

/**
 * Full backtest: reads stored SnapshotPerformance rows, backfills any missing
 * periods, and returns the complete timeline.
 */
export async function runBacktest(kolId: string): Promise<BacktestResult> {
  const snapshots = await portfolioRepo.findSnapshotHistory(kolId, 500);

  if (snapshots.length < 2) {
    return {
      kolId,
      snapshotCount: snapshots.length,
      periods: [],
      totalReturn: 0,
      latestCumulativeValue: 1,
    };
  }

  // Sort ascending by createdAt, then deduplicate same-day snapshots
  snapshots.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const dedupedSnapshots = deduplicateByDay(snapshots);

  // Collect all symbols across all snapshots for price fetching
  const allSymbols = new Set<string>();
  for (const snap of dedupedSnapshots) {
    for (const alloc of parseAllocations(snap)) {
      allSymbols.add(alloc.asset);
    }
  }

  // Ensure prices for the full range
  const globalFrom = new Date(dedupedSnapshots[0]!.createdAt.getTime() - 24 * 60 * 60 * 1000);
  const globalTo = new Date(dedupedSnapshots[dedupedSnapshots.length - 1]!.createdAt.getTime() + 24 * 60 * 60 * 1000);
  await ensurePricesForSymbols([...allSymbols], globalFrom, globalTo);

  // Load existing stored periods
  const storedPeriods = await perfRepo.findByKol(kolId);
  const storedMap = new Map<string, typeof storedPeriods[number]>();
  for (const sp of storedPeriods) {
    storedMap.set(`${sp.fromSnapshotId}:${sp.toSnapshotId}`, sp);
  }

  const periods: PeriodResult[] = [];
  let cumulativeValue = 1;

  for (let i = 0; i < dedupedSnapshots.length - 1; i++) {
    const current = dedupedSnapshots[i]!;
    const next = dedupedSnapshots[i + 1]!;
    const key = `${current.id}:${next.id}`;

    const stored = storedMap.get(key);
    if (stored) {
      // Recompute cumulative from running product (stored value may be stale)
      cumulativeValue = cumulativeValue * (1 + stored.periodReturn);
      periods.push({
        fromSnapshotId: stored.fromSnapshotId,
        toSnapshotId: stored.toSnapshotId,
        fromDate: current.createdAt.toISOString(),
        toDate: next.createdAt.toISOString(),
        periodReturn: stored.periodReturn,
        cumulativeValue,
        periodDays: stored.periodDays,
        details: (stored.details as PeriodResult["details"]) ?? {},
      });
      continue;
    }

    // Compute missing period
    const result = await computePeriod(current, next, cumulativeValue);
    cumulativeValue = result.cumulativeValue;

    // Store it
    await perfRepo.upsert({
      kolId,
      fromSnapshotId: result.fromSnapshotId,
      toSnapshotId: result.toSnapshotId,
      periodReturn: result.periodReturn,
      cumulativeValue: result.cumulativeValue,
      periodDays: result.periodDays,
      details: result.details as unknown as Prisma.InputJsonValue,
    });

    periods.push(result);
  }

  const totalReturn = cumulativeValue - 1;

  logger.info(
    { kolId, periods: periods.length, totalReturn, cumulativeValue },
    "Backtest complete"
  );

  return {
    kolId,
    snapshotCount: snapshots.length,
    periods,
    totalReturn,
    latestCumulativeValue: cumulativeValue,
  };
}
