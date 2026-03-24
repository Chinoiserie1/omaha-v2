import type { PublicKey } from "@solana/web3.js";
import { computeTvl, type ComputeTvlOptions } from "../services/tvl.service.js";
import { computeSharePrice } from "../services/share-price.service.js";
import type { VaultHolding } from "@repo/shared";

/**
 * Fetch on-chain vault holdings with USD valuations.
 * Reads SPL token accounts owned by the vault PDA + cached DB prices.
 * Pass `{ livePrices: true }` to fetch fresh prices from Jupiter/Birdeye.
 */
export async function getVaultHoldings(
  statePda: PublicKey,
  options?: ComputeTvlOptions,
): Promise<{
  holdings: VaultHolding[];
  totalEquityUsd: number;
}> {
  return computeTvl(statePda, options);
}

/**
 * Compute share price: total vault equity / share mint total supply.
 * Returns null if supply is zero or data cannot be fetched.
 */
export async function getSharePrice(statePda: PublicKey): Promise<number | null> {
  const result = await computeSharePrice(statePda);
  return result.computedPriceUsd;
}

/**
 * Convert holdings to a percentage allocation map keyed by mint address.
 */
export function holdingsToAllocationPcts(
  holdings: VaultHolding[],
  totalEquityUsd: number
): Map<string, number> {
  const pcts = new Map<string, number>();

  if (totalEquityUsd <= 0) return pcts;

  for (const h of holdings) {
    pcts.set(h.mint, (h.valueUsd / totalEquityUsd) * 100);
  }

  return pcts;
}
