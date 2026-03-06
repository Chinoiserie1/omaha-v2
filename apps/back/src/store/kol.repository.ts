import { prisma } from "@repo/database";
import type { Kol, Prisma } from "@repo/database";

export async function findAllKols(activeOnly: boolean): Promise<
  (Kol & { _count: { tweets: number } })[]
> {
  return prisma.kol.findMany({
    ...(activeOnly ? { where: { isActive: true } } : {}),
    include: { _count: { select: { tweets: true } } },
    orderBy: { username: "asc" },
  });
}

export async function findKolById(id: string): Promise<Kol | null> {
  return prisma.kol.findUnique({ where: { id } });
}

export async function findKolWithTweets(
  id: string,
  tweetLimit: number
): Promise<(Kol & { tweets: unknown[] }) | null> {
  return prisma.kol.findUnique({
    where: { id },
    include: {
      tweets: {
        orderBy: { postedAt: "desc" },
        take: tweetLimit,
      },
    },
  });
}

export async function findKolByUsername(
  username: string
): Promise<Kol | null> {
  return prisma.kol.findUnique({ where: { username } });
}

export async function findActiveKols(): Promise<Kol[]> {
  return prisma.kol.findMany({ where: { isActive: true } });
}

export async function updateKolProfile(
  id: string,
  data: {
    restId?: string;
    displayName?: string;
    followersCount?: number;
    avatarUrl?: string;
    bio?: string;
  }
): Promise<Kol> {
  return prisma.kol.update({ where: { id }, data });
}

export async function updateKolLastFetched(id: string): Promise<Kol> {
  return prisma.kol.update({
    where: { id },
    data: { lastFetchedAt: new Date() },
  });
}

export async function upsertKol(username: string): Promise<Kol> {
  return prisma.kol.upsert({
    where: { username },
    update: {},
    create: { username },
  });
}

export async function updateKolKnowledge(
  id: string,
  knowledge: Prisma.InputJsonValue,
): Promise<Kol> {
  return prisma.kol.update({ where: { id }, data: { knowledge } });
}
