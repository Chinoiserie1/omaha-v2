import type { SnapshotAllocation, SnapshotHolding } from "@repo/database";
import type { Allocation, VaultHoldingWithPct } from "@repo/shared";

// ── Allocation converters ────────────────────────────────────

export interface AllocationCreateInput {
  readonly asset: string;
  readonly mint?: string | null;
  readonly tokenId?: string | null;
  readonly percentage: number;
  readonly conviction: string;
  readonly reasoning: string;
  readonly since: string;
  readonly lastSignal: string;
}

export function allocationRowsToAllocations(
  rows: readonly SnapshotAllocation[],
): Allocation[] {
  return rows.map((r) => {
    const alloc: Allocation = {
      asset: r.asset,
      percentage: r.percentage,
      conviction: r.conviction as Allocation["conviction"],
      reasoning: r.reasoning,
      since: r.since,
      lastSignal: r.lastSignal,
    };
    if (r.mint) alloc.mint = r.mint;
    return alloc;
  });
}

export function allocationsToCreateInputs(
  allocs: readonly Allocation[],
  tokenMap?: ReadonlyMap<string, string>,
): AllocationCreateInput[] {
  return allocs.map((a) => ({
    asset: a.asset,
    mint: a.mint ?? null,
    tokenId: a.mint ? (tokenMap?.get(a.mint) ?? null) : null,
    percentage: a.percentage,
    conviction: a.conviction,
    reasoning: a.reasoning,
    since: a.since,
    lastSignal: a.lastSignal,
  }));
}

// ── Holding converters ───────────────────────────────────────

export interface HoldingCreateInput {
  readonly mint: string;
  readonly symbol: string;
  readonly tokenId?: string | null;
  readonly uiAmount: number;
  readonly price: number;
  readonly valueUsd: number;
  readonly percentage: number;
}

export function holdingRowsToHoldings(
  rows: readonly SnapshotHolding[],
): VaultHoldingWithPct[] {
  return rows.map((r) => ({
    mint: r.mint,
    symbol: r.symbol,
    uiAmount: r.uiAmount,
    price: r.price,
    valueUsd: r.valueUsd,
    percentage: r.percentage,
  }));
}

export function holdingsToCreateInputs(
  holdings: readonly VaultHoldingWithPct[],
  tokenMap?: ReadonlyMap<string, string>,
): HoldingCreateInput[] {
  return holdings.map((h) => ({
    mint: h.mint,
    symbol: h.symbol,
    tokenId: tokenMap?.get(h.mint) ?? null,
    uiAmount: h.uiAmount,
    price: h.price,
    valueUsd: h.valueUsd,
    percentage: h.percentage,
  }));
}
