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

export interface PriceWithDate {
  readonly usdPrice: number;
  readonly date: Date;
}

export async function getLatestPriceMapWithDates(): Promise<
  Map<string, PriceWithDate>
> {
  const tokens = await prisma.token.findMany({
    include: {
      prices: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  const map = new Map<string, PriceWithDate>();
  for (const token of tokens) {
    if (token.prices.length > 0) {
      const p = token.prices[0]!;
      map.set(token.mint, { usdPrice: p.usdPrice, date: p.date });
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

export async function getVaultPerformanceByMints(
  mints: string[]
): Promise<Map<string, number>> {
  if (mints.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    { mint: string; first_price: number; last_price: number }[]
  >`
    SELECT DISTINCT ON (t.mint)
      t.mint,
      FIRST_VALUE(tp."usdPrice") OVER w AS first_price,
      LAST_VALUE(tp."usdPrice") OVER w AS last_price
    FROM "Token" t
    JOIN "TokenPrice" tp ON tp."tokenId" = t.id
    WHERE t."isVault" = true AND t.mint = ANY(${mints}::text[])
    WINDOW w AS (
      PARTITION BY tp."tokenId"
      ORDER BY tp.date
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    )
  `;

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.first_price > 0) {
      const pct =
        ((row.last_price - row.first_price) / row.first_price) * 100;
      map.set(row.mint, Math.round(pct * 10) / 10);
    }
  }
  return map;
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
