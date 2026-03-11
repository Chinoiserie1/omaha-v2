import { prisma } from "@repo/database";
import type { TradeableAsset } from "@repo/database";

export async function upsertAsset(data: {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoUri?: string | null;
}): Promise<TradeableAsset> {
  return prisma.tradeableAsset.upsert({
    where: { symbol: data.symbol },
    update: {
      name: data.name,
      mint: data.mint,
      decimals: data.decimals,
      isActive: true,
      ...(data.logoUri !== undefined ? { logoUri: data.logoUri } : {}),
    },
    create: {
      symbol: data.symbol,
      name: data.name,
      mint: data.mint,
      decimals: data.decimals,
      ...(data.logoUri ? { logoUri: data.logoUri } : {}),
    },
  });
}

export async function findAllActiveAssets(): Promise<TradeableAsset[]> {
  // Omit logoUri — column may not exist on older prod DBs
  const rows = await prisma.tradeableAsset.findMany({
    where: { isActive: true },
    select: { id: true, symbol: true, name: true, mint: true, decimals: true, isActive: true },
  });
  return rows as unknown as TradeableAsset[];
}

export async function findAssetBySymbol(
  symbol: string
): Promise<TradeableAsset | null> {
  return prisma.tradeableAsset.findUnique({
    where: { symbol },
  });
}

export async function getLogoUriByMints(
  mints: string[]
): Promise<Map<string, string>> {
  if (mints.length === 0) return new Map();

  const assets = await prisma.tradeableAsset.findMany({
    where: { mint: { in: mints }, logoUri: { not: null } },
    select: { mint: true, logoUri: true },
  });

  const map = new Map<string, string>();
  for (const asset of assets) {
    if (asset.logoUri) {
      map.set(asset.mint, asset.logoUri);
    }
  }
  return map;
}
