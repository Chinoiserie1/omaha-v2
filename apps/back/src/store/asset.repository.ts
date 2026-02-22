import { prisma } from "@repo/database";
import type { TradeableAsset } from "@repo/database";

export async function upsertAsset(data: {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
}): Promise<TradeableAsset> {
  return prisma.tradeableAsset.upsert({
    where: { symbol: data.symbol },
    update: {
      name: data.name,
      mint: data.mint,
      decimals: data.decimals,
      isActive: true,
    },
    create: data,
  });
}

export async function findAllActiveAssets(): Promise<TradeableAsset[]> {
  return prisma.tradeableAsset.findMany({
    where: { isActive: true },
  });
}

export async function findAssetBySymbol(
  symbol: string
): Promise<TradeableAsset | null> {
  return prisma.tradeableAsset.findUnique({
    where: { symbol },
  });
}
