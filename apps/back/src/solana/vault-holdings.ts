import { PublicKey } from "@solana/web3.js";
import { getGlamClient } from "./client.js";
import { getConnection } from "./config.js";
import { logger } from "../utils/logger.js";
import type { VaultHolding } from "@repo/shared";

/**
 * Fetch on-chain vault holdings with USD valuations.
 */
export async function getVaultHoldings(statePda: PublicKey): Promise<{
  holdings: VaultHolding[];
  totalEquityUsd: number;
}> {
  const client = getGlamClient(statePda);
  const result = await client.price.getVaultHoldings("confirmed");

  let totalEquityUsd = 0;
  const holdings: VaultHolding[] = [];

  for (const h of result.holdings) {
    const valueUsd = h.uiAmount * h.price;
    totalEquityUsd += valueUsd;
    holdings.push({
      mint: h.mintAddress.toBase58(),
      symbol: h.mintAddress.toBase58().slice(0, 8),
      uiAmount: h.uiAmount,
      price: h.price,
      valueUsd,
    });
  }

  logger.debug(
    { totalEquityUsd, holdingsCount: holdings.length },
    "Vault holdings fetched"
  );

  return { holdings, totalEquityUsd };
}

/**
 * Compute share price: total vault equity / share mint total supply.
 * Returns null if supply is zero or data cannot be fetched.
 */
export async function getSharePrice(statePda: PublicKey): Promise<number | null> {
  const client = getGlamClient(statePda);
  const stateModel = await client.fetchStateModel();

  if (!stateModel.mint) return null;

  const shareMint = new PublicKey(stateModel.mint);
  const connection = getConnection();

  const [{ totalEquityUsd }, supplyResult] = await Promise.all([
    getVaultHoldings(statePda),
    connection.getTokenSupply(shareMint),
  ]);

  const supplyUiAmount = supplyResult.value.uiAmount ?? 0;
  if (supplyUiAmount <= 0) return null;

  return totalEquityUsd / supplyUiAmount;
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
