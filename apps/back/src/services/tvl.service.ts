import { PublicKey } from "@solana/web3.js";
import { getConnection } from "../solana/config.js";
import * as tokenPriceRepo from "../store/token-price.repository.js";
import { logger } from "../utils/logger.js";
import type { VaultHolding } from "@repo/shared";

export interface ComputeTvlOptions {
  /**
   * Maximum allowed age for token prices in milliseconds.
   * When set, throws if any held token has a price older than this or no price at all.
   * When omitted, stale/missing prices default to 0 (display-safe).
   */
  readonly maxAgeMs?: number;
}

/**
 * Compute TVL for a vault by reading on-chain SPL token accounts
 * owned by the vault state PDA and looking up cached prices from DB.
 */
export async function computeTvl(
  statePda: PublicKey,
  options: ComputeTvlOptions = {},
): Promise<{
  holdings: VaultHolding[];
  totalEquityUsd: number;
}> {
  const connection = getConnection();

  // Get all token accounts owned by the vault state PDA
  const [tokenAccounts, token2022Accounts] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(statePda, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    }),
    connection.getParsedTokenAccountsByOwner(statePda, {
      programId: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
    }),
  ]);

  const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value];

  if (allAccounts.length === 0) {
    return { holdings: [], totalEquityUsd: 0 };
  }

  const strict = options.maxAgeMs !== undefined;
  const now = Date.now();

  // Use dated prices when strict validation is needed
  const priceMap = strict
    ? await tokenPriceRepo.getLatestPriceMapWithDates()
    : null;
  const simplePriceMap = strict
    ? null
    : await tokenPriceRepo.getLatestPriceMap();

  let totalEquityUsd = 0;
  const holdings: VaultHolding[] = [];

  for (const account of allAccounts) {
    const parsed = account.account.data.parsed;
    if (parsed.type !== "account") continue;

    const info = parsed.info;
    const mint: string = info.mint;
    const uiAmount: number = info.tokenAmount?.uiAmount ?? 0;

    if (uiAmount <= 0) continue;

    let price: number;

    if (strict && priceMap) {
      const entry = priceMap.get(mint);
      if (!entry) {
        throw new Error(
          `No price found for token ${mint} held by vault ${statePda.toBase58()}`,
        );
      }
      const ageMs = now - entry.date.getTime();
      if (ageMs > options.maxAgeMs!) {
        throw new Error(
          `Stale price for token ${mint}: ${Math.round(ageMs / 1000)}s old (max ${Math.round(options.maxAgeMs! / 1000)}s)`,
        );
      }
      price = entry.usdPrice;
    } else {
      price = simplePriceMap?.get(mint) ?? 0;
    }

    const valueUsd = uiAmount * price;
    totalEquityUsd += valueUsd;

    holdings.push({
      mint,
      symbol: mint.slice(0, 8),
      uiAmount,
      price,
      valueUsd,
    });
  }

  logger.debug(
    { totalEquityUsd, holdingsCount: holdings.length, strict },
    "TVL computed from on-chain accounts + DB prices",
  );

  return { holdings, totalEquityUsd };
}
