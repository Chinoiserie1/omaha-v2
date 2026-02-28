import axios from "axios";
import { logger } from "../utils/logger.js";
import { env } from "../utils/env.js";
import * as tokenPriceRepo from "../store/token-price.repository.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const JUPITER_PRICE_URL = "https://api.jup.ag/price/v3";

interface JupiterPriceResponse {
  [mint: string]: { usdPrice: number; decimals: number } | undefined;
}

const SEED_TOKENS = [
  { name: "Solana", symbol: "SOL", decimals: 9, mint: SOL_MINT },
  { name: "USD Coin", symbol: "USDC", decimals: 6, mint: USDC_MINT },
];

export async function fetchAndStorePrices(): Promise<void> {
  // Ensure seed tokens exist
  for (const token of SEED_TOKENS) {
    await tokenPriceRepo.upsertToken(token);
  }

  // USDC is always $1.00
  const usdcToken = await tokenPriceRepo.findTokenByMint(USDC_MINT);
  if (usdcToken) {
    await tokenPriceRepo.insertPrice(usdcToken.id, 1.0);
  }

  // Fetch SOL price from Jupiter
  try {
    const { data } = await axios.get<JupiterPriceResponse>(JUPITER_PRICE_URL, {
      params: { ids: SOL_MINT },
      headers: { "x-api-key": env.JUPITER_API_KEY },
    });

    const solPrice = data[SOL_MINT];
    if (solPrice) {
      const price = solPrice.usdPrice;
      const solToken = await tokenPriceRepo.findTokenByMint(SOL_MINT);
      if (solToken) {
        await tokenPriceRepo.insertPrice(solToken.id, price);
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to fetch SOL price from Jupiter");
  }
}
