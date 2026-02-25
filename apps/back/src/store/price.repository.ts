import { prisma } from "@repo/database";
import type { TokenPriceDaily } from "@repo/database";

export async function upsertDailyPrice(data: {
  symbol: string;
  date: Date;
  priceUsd: number;
  source: string;
}): Promise<TokenPriceDaily> {
  return prisma.tokenPriceDaily.upsert({
    where: {
      symbol_date: { symbol: data.symbol, date: data.date },
    },
    update: { priceUsd: data.priceUsd, source: data.source },
    create: data,
  });
}

export async function findPriceOnDate(
  symbol: string,
  date: Date
): Promise<TokenPriceDaily | null> {
  return prisma.tokenPriceDaily.findUnique({
    where: { symbol_date: { symbol, date } },
  });
}

/**
 * Find the closest price within +-3 days of the target date.
 */
export async function findPriceNearDate(
  symbol: string,
  date: Date
): Promise<TokenPriceDaily | null> {
  const windowMs = 3 * 24 * 60 * 60 * 1000;
  const from = new Date(date.getTime() - windowMs);
  const to = new Date(date.getTime() + windowMs);

  return prisma.tokenPriceDaily.findFirst({
    where: {
      symbol,
      date: { gte: from, lte: to },
    },
    orderBy: { date: "desc" },
  });
}

export async function countPricesInRange(
  symbol: string,
  from: Date,
  to: Date
): Promise<number> {
  return prisma.tokenPriceDaily.count({
    where: {
      symbol,
      date: { gte: from, lte: to },
    },
  });
}
