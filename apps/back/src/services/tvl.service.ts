import { PublicKey } from "@solana/web3.js";
import { getConnection } from "../solana/config.js";
import * as tokenPriceRepo from "../store/token-price.repository.js";
import { logger } from "../utils/logger.js";
import type { VaultHolding } from "@repo/shared";

/**
 * Compute TVL for a vault by reading on-chain SPL token accounts
 * owned by the vault state PDA and looking up cached prices from DB.
 */
export async function computeTvl(statePda: PublicKey): Promise<{
  holdings: VaultHolding[];
  totalEquityUsd: number;
}> {
  const connection = getConnection();

  // Get all token accounts owned by the vault state PDA
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    statePda,
    { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") },
  );

  // Also check Token 2022 accounts (share mint uses Token 2022)
  const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
    statePda,
    { programId: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") },
  );

  const allAccounts = [
    ...tokenAccounts.value,
    ...token2022Accounts.value,
  ];

  if (allAccounts.length === 0) {
    return { holdings: [], totalEquityUsd: 0 };
  }

  // Get cached prices from DB
  const priceMap = await tokenPriceRepo.getLatestPriceMap();

  let totalEquityUsd = 0;
  const holdings: VaultHolding[] = [];

  for (const account of allAccounts) {
    const parsed = account.account.data.parsed;
    if (parsed.type !== "account") continue;

    const info = parsed.info;
    const mint: string = info.mint;
    const uiAmount: number = info.tokenAmount?.uiAmount ?? 0;

    if (uiAmount <= 0) continue;

    const price = priceMap.get(mint) ?? 0;
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
    { totalEquityUsd, holdingsCount: holdings.length },
    "TVL computed from on-chain accounts + DB prices",
  );

  return { holdings, totalEquityUsd };
}
