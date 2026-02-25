import { prisma } from "@repo/database";
import type { Token, TokenPrice } from "@repo/database";

export async function upsertToken(data: {
  name: string;
  symbol: string;
  decimals: number;
  mint: string;
}): Promise<Token> {
  return prisma.token.upsert({
    where: { mint: data.mint },
    update: {
      name: data.name,
      symbol: data.symbol,
      decimals: data.decimals,
    },
    create: data,
  });
}

export async function insertPrice(
  tokenId: string,
  usdPrice: number,
): Promise<TokenPrice> {
  return prisma.tokenPrice.create({
    data: { tokenId, usdPrice },
  });
}

export async function getLatestPriceMap(): Promise<Map<string, number>> {
  const tokens = await prisma.token.findMany({
    include: {
      prices: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  const map = new Map<string, number>();
  for (const token of tokens) {
    if (token.prices.length > 0) {
      map.set(token.mint, token.prices[0]!.usdPrice);
    }
  }
  return map;
}

export async function findTokenByMint(mint: string): Promise<Token | null> {
  return prisma.token.findUnique({ where: { mint } });
}

export async function upsertVaultToken(data: {
  name: string;
  symbol: string;
  decimals: number;
  mint: string;
}): Promise<Token> {
  return prisma.token.upsert({
    where: { mint: data.mint },
    update: {
      name: data.name,
      symbol: data.symbol,
      decimals: data.decimals,
      isVault: true,
    },
    create: { ...data, isVault: true },
  });
}

export async function findAllVaultTokens(): Promise<Token[]> {
  return prisma.token.findMany({ where: { isVault: true } });
}

export async function getPriceHistory(
  tokenId: string,
  since: Date,
  maxPoints?: number,
): Promise<{ usdPrice: number; date: Date }[]> {
  if (!maxPoints || maxPoints <= 0) {
    return prisma.tokenPrice.findMany({
      where: { tokenId, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { usdPrice: true, date: true },
    });
  }

  return prisma.$queryRaw<{ usdPrice: number; date: Date }[]>`
    WITH numbered AS (
      SELECT "usdPrice", date,
             ROW_NUMBER() OVER (ORDER BY date) AS rn,
             COUNT(*) OVER () AS total
      FROM "TokenPrice"
      WHERE "tokenId" = ${tokenId} AND date >= ${since}
    )
    SELECT "usdPrice", date
    FROM numbered
    WHERE total <= ${maxPoints}
       OR rn % GREATEST(total / ${maxPoints}, 1) = 0
       OR rn = total
    ORDER BY date
  `;
}
