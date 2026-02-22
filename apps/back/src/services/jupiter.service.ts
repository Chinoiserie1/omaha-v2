import axios from "axios";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import * as assetRepo from "../store/asset.repository.js";

const JUPITER_TOKENS_URL =
  "https://api.jup.ag/tokens/v2/tag?query=verified";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface JupiterToken {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
}

export async function syncTradeableAssets(): Promise<number> {
  const response = await axios.get<JupiterToken[]>(JUPITER_TOKENS_URL, {
    headers: { "x-api-key": env.JUPITER_API_KEY },
  });

  const tokens = response.data;
  logger.info({ count: tokens.length }, "Fetched verified tokens from Jupiter");

  let upserted = 0;
  for (const token of tokens) {
    await assetRepo.upsertAsset({
      symbol: token.symbol,
      name: token.name,
      mint: token.id,
      decimals: token.decimals,
    });
    upserted++;
  }

  // Ensure USDC always exists
  await assetRepo.upsertAsset({
    symbol: "USDC",
    name: "USD Coin",
    mint: USDC_MINT,
    decimals: 6,
  });

  logger.info({ upserted }, "Synced tradeable assets");
  return upserted;
}

export async function getTradeableAssetsMap(): Promise<
  Map<string, { mint: string; decimals: number }>
> {
  const assets = await assetRepo.findAllActiveAssets();
  const map = new Map<string, { mint: string; decimals: number }>();

  for (const asset of assets) {
    map.set(asset.symbol, { mint: asset.mint, decimals: asset.decimals });
  }

  return map;
}
