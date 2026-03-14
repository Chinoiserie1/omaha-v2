import type { PublicKey } from "@solana/web3.js";
import { getConnection } from "../solana/config.js";
import { deserializeVaultState } from "@repo/omaha-programs-sdk";
import { computeTvl } from "./tvl.service.js";
import { logger } from "../utils/logger.js";

export interface SharePriceResult {
  /** NAV-based share price: TVL / total share supply */
  computedPriceUsd: number | null;
  /** On-chain share price set by admin (in base token smallest units) */
  onChainPrice: bigint;
  /** Total share supply (ui amount) */
  totalShareSupply: number;
  /** TVL in USD */
  tvlUsd: number;
}

/**
 * Compute share price for a vault.
 * Returns both the NAV-based computed price and the on-chain admin-set price.
 */
export async function computeSharePrice(
  statePda: PublicKey,
): Promise<SharePriceResult> {
  const connection = getConnection();

  // Read vault state from on-chain
  const accountInfo = await connection.getAccountInfo(statePda);
  if (!accountInfo) {
    throw new Error(`Vault state account not found: ${statePda.toBase58()}`);
  }

  const vaultState = deserializeVaultState(Buffer.from(accountInfo.data));
  const shareMint = vaultState.shareMint;

  // Get total share supply and TVL in parallel
  const [supplyResult, { totalEquityUsd }] = await Promise.all([
    connection.getTokenSupply(shareMint),
    computeTvl(statePda),
  ]);

  const totalShareSupply = supplyResult.value.uiAmount ?? 0;

  const computedPriceUsd =
    totalShareSupply > 0 ? totalEquityUsd / totalShareSupply : null;

  logger.debug(
    {
      statePda: statePda.toBase58(),
      tvlUsd: totalEquityUsd,
      totalShareSupply,
      computedPriceUsd,
      onChainPrice: vaultState.sharePrice.toString(),
    },
    "Share price computed",
  );

  return {
    computedPriceUsd,
    onChainPrice: vaultState.sharePrice,
    totalShareSupply,
    tvlUsd: totalEquityUsd,
  };
}
