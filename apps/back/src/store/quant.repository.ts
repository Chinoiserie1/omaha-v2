import { prisma } from "@repo/database";
import type { Quant, Prisma } from "@repo/database";

export async function findAllQuants(activeOnly: boolean): Promise<
  (Quant & { user: { twitterUsername: string | null; profileImageUrl: string | null; bio: string | null; twitterFollowerCount: number | null }; _count: { tweets: number } })[]
> {
  return prisma.quant.findMany({
    ...(activeOnly ? { where: { isActive: true } } : {}),
    include: {
      user: {
        select: {
          twitterUsername: true,
          profileImageUrl: true,
          bio: true,
          twitterFollowerCount: true,
        },
      },
      _count: { select: { tweets: true } },
    },
    orderBy: { user: { twitterUsername: "asc" } },
  });
}

export async function findQuantById(id: string): Promise<(Quant & { user: { twitterUsername: string | null; twitterId: string | null; profileImageUrl: string | null; bio: string | null; twitterFollowerCount: number | null; name: string | null } }) | null> {
  return prisma.quant.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          twitterUsername: true,
          twitterId: true,
          profileImageUrl: true,
          bio: true,
          twitterFollowerCount: true,
          name: true,
        },
      },
    },
  });
}

export async function findQuantWithTweets(
  id: string,
  tweetLimit: number
): Promise<(Quant & { user: { twitterUsername: string | null; profileImageUrl: string | null; bio: string | null; twitterFollowerCount: number | null; name: string | null }; tweets: unknown[] }) | null> {
  return prisma.quant.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          twitterUsername: true,
          profileImageUrl: true,
          bio: true,
          twitterFollowerCount: true,
          name: true,
        },
      },
      tweets: {
        orderBy: { postedAt: "desc" },
        take: tweetLimit,
      },
    },
  });
}

export async function findActiveQuants(): Promise<(Quant & { user: { twitterUsername: string | null; twitterId: string | null; profileImageUrl: string | null; bio: string | null; twitterFollowerCount: number | null; name: string | null; hasTwitter: boolean } })[]> {
  return prisma.quant.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: {
          twitterUsername: true,
          twitterId: true,
          profileImageUrl: true,
          bio: true,
          twitterFollowerCount: true,
          name: true,
          hasTwitter: true,
        },
      },
    },
  });
}

export async function findQuantByUsername(
  twitterUsername: string
): Promise<(Quant & { user: { twitterUsername: string | null } }) | null> {
  return prisma.quant.findFirst({
    where: { user: { twitterUsername } },
    include: {
      user: { select: { twitterUsername: true } },
    },
  });
}

export async function updateQuantLastFetched(id: string): Promise<Quant> {
  return prisma.quant.update({
    where: { id },
    data: { lastFetchedAt: new Date() },
  });
}

export async function upsertQuantByUsername(twitterUsername: string): Promise<Quant & { user: { twitterUsername: string | null; twitterId: string | null; profileImageUrl: string | null; bio: string | null; twitterFollowerCount: number | null; name: string | null } }> {
  const existingUser = await prisma.user.findFirst({
    where: { twitterUsername },
    include: { quant: true },
  });

  if (existingUser?.quant) {
    return prisma.quant.findUniqueOrThrow({
      where: { id: existingUser.quant.id },
      include: {
        user: {
          select: {
            twitterUsername: true,
            twitterId: true,
            profileImageUrl: true,
            bio: true,
            twitterFollowerCount: true,
            name: true,
          },
        },
      },
    });
  }

  const user = existingUser ?? await prisma.user.create({
    data: {
      twitterUsername,
      hasTwitter: true,
      userType: "PLACEHOLDER",
    },
  });

  return prisma.quant.create({
    data: { userId: user.id },
    include: {
      user: {
        select: {
          twitterUsername: true,
          twitterId: true,
          profileImageUrl: true,
          bio: true,
          twitterFollowerCount: true,
          name: true,
        },
      },
    },
  });
}

export async function updateUserProfile(
  userId: string,
  data: {
    twitterId?: string;
    name?: string;
    twitterFollowerCount?: number;
    profileImageUrl?: string;
    bio?: string;
  }
): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data });
}

export async function findTopQuants(limit: number) {
  return prisma.quant.findMany({
    where: {
      isActive: true,
      user: { twitterFollowerCount: { not: null, gt: 0 } },
    },
    orderBy: { user: { twitterFollowerCount: "desc" } },
    take: limit,
    include: {
      user: {
        select: {
          twitterUsername: true,
          name: true,
          profileImageUrl: true,
          twitterFollowerCount: true,
        },
      },
      vault: { select: { id: true } },
      _count: { select: { tweetImpacts: true } },
    },
  });
}

export async function updateQuantKnowledge(
  id: string,
  knowledge: Prisma.InputJsonValue,
): Promise<Quant> {
  return prisma.quant.update({ where: { id }, data: { knowledge } });
}
