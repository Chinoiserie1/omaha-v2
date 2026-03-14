import * as tokenPriceRepo from "../store/token-price.repository.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/**
 * Ensure seed tokens exist in DB. Actual price fetching is done by
 * the price worker (src/workers/price-worker.ts).
 * This function only seeds USDC at $1.00 as a fallback.
 */
export async function fetchAndStorePrices(): Promise<void> {
  // Ensure USDC token exists and is priced at $1.00
  const usdcToken = await tokenPriceRepo.upsertToken({
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    mint: USDC_MINT,
  });
  await tokenPriceRepo.insertPrice(usdcToken.id, 1.0);
}
