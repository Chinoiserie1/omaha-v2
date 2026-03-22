import { prisma } from "@repo/database";
import type { Token } from "@repo/database";

export async function upsertAsset(data: {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoUri?: string | null;
}): Promise<Token> {
  return prisma.token.upsert({
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
      isActive: true,
      ...(data.logoUri ? { logoUri: data.logoUri } : {}),
    },
  });
}

export async function findAllActiveAssets(): Promise<Token[]> {
  return prisma.token.findMany({
    where: { isActive: true },
  });
}

export async function findAssetBySymbol(
  symbol: string
): Promise<Token | null> {
  return prisma.token.findUnique({
    where: { symbol },
  });
}

export async function getLogoUriByMints(
  mints: string[]
): Promise<Map<string, string>> {
  if (mints.length === 0) return new Map();

  const tokens = await prisma.token.findMany({
    where: { mint: { in: mints }, logoUri: { not: null } },
    select: { mint: true, logoUri: true },
  });

  const map = new Map<string, string>();
  for (const token of tokens) {
    if (token.logoUri) {
      map.set(token.mint, token.logoUri);
    }
  }
  return map;
}
