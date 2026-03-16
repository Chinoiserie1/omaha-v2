import type { PublicKey } from "@solana/web3.js";
import type { VaultState } from "@repo/omaha-programs-sdk";
import { deserializeVaultState } from "@repo/omaha-programs-sdk";
import { getConnection } from "../solana/config.js";
import { computeTvl } from "./tvl.service.js";
import { logger } from "../utils/logger.js";

const USDC_DECIMALS = 6;
const SHARE_TOKEN_DECIMALS = 6;
const INITIAL_SHARE_PRICE = 1_000_000n; // 1:1 with USDC
const MAX_PRICE_AGE_MS = 120_000; // 2 minutes

export interface OnChainSharePriceResult {
  /** Share price in base token raw units (u64) for on-chain instructions */
  readonly sharePrice: bigint;
  /** Deserialized vault state (reuse to avoid extra RPC call) */
  readonly vaultState: VaultState;
  /** Total share supply in raw units */
  readonly totalSupplyRaw: bigint;
  /** TVL in USD */
  readonly tvlUsd: number;
}

/**
 * Compute share price for on-chain DepositWithPrice / WithdrawWithPrice.
 *
 * Formula: share_price = (tvl_in_base_raw * 10^share_decimals) / total_supply_raw
 *
 * Returns INITIAL_SHARE_PRICE (1:1) when supply is zero (first deposit).
 */
export async function computeOnChainSharePrice(
  statePda: PublicKey,
): Promise<OnChainSharePriceResult> {
  const connection = getConnection();

  const accountInfo = await connection.getAccountInfo(statePda);
  if (!accountInfo) {
    throw new Error(`Vault state not found: ${statePda.toBase58()}`);
  }

  const vaultState = deserializeVaultState(Buffer.from(accountInfo.data));

  const [supplyResult, { totalEquityUsd }] = await Promise.all([
    connection.getTokenSupply(vaultState.shareMint),
    computeTvl(statePda, { maxAgeMs: MAX_PRICE_AGE_MS }),
  ]);

  const totalSupplyRaw = BigInt(supplyResult.value.amount);

  if (totalSupplyRaw === 0n) {
    logger.info(
      { statePda: statePda.toBase58(), tvlUsd: totalEquityUsd },
      "Zero share supply — using initial share price 1:1",
    );
    return {
      sharePrice: INITIAL_SHARE_PRICE,
      vaultState,
      totalSupplyRaw,
      tvlUsd: totalEquityUsd,
    };
  }

  const tvlInBaseRaw = BigInt(
    Math.round(totalEquityUsd * 10 ** USDC_DECIMALS),
  );
  const computed =
    (tvlInBaseRaw * BigInt(10 ** SHARE_TOKEN_DECIMALS)) / totalSupplyRaw;

  // Ensure at least 1 to prevent division-by-zero on-chain
  const sharePrice = computed > 0n ? computed : INITIAL_SHARE_PRICE;

  logger.info(
    {
      statePda: statePda.toBase58(),
      tvlUsd: totalEquityUsd,
      totalSupplyRaw: totalSupplyRaw.toString(),
      sharePrice: sharePrice.toString(),
    },
    "On-chain share price computed",
  );

  return { sharePrice, vaultState, totalSupplyRaw, tvlUsd: totalEquityUsd };
}
