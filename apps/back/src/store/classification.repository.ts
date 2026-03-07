import { prisma } from "@repo/database";
import type { ClassifiedTweet, Prisma } from "@repo/database";

export async function createClassification(data: {
  tweetId: string;
  category: string;
  assets: string[];
  sentiment: string | null;
  conviction: string | null;
  rawLlmResponse?: unknown;
}): Promise<ClassifiedTweet> {
  const createData: {
    tweetId: string;
    category: string;
    assets: string[];
    sentiment: string | null;
    conviction: string | null;
    rawLlmResponse?: Prisma.InputJsonValue;
  } = {
    tweetId: data.tweetId,
    category: data.category,
    assets: data.assets,
    sentiment: data.sentiment,
    conviction: data.conviction,
  };

  if (data.rawLlmResponse !== undefined) {
    createData.rawLlmResponse = data.rawLlmResponse as Prisma.InputJsonValue;
  }

  return prisma.classifiedTweet.create({
    data: createData,
  });
}

export async function findUnclassifiedTweetsByQuant(quantId: string) {
  return prisma.tweet.findMany({
    where: {
      quantId,
      classification: null,
    },
    orderBy: { postedAt: "asc" },
  });
}

export async function findClassificationsByTweetIds(tweetIds: string[]) {
  return prisma.classifiedTweet.findMany({
    where: { tweetId: { in: tweetIds } },
    include: { tweet: true },
  });
}

export async function deleteAllClassifications(quantId: string): Promise<number> {
  const tweetIds = await prisma.tweet.findMany({
    where: { quantId },
    select: { id: true },
  });
  const result = await prisma.classifiedTweet.deleteMany({
    where: { tweetId: { in: tweetIds.map((t) => t.id) } },
  });
  return result.count;
}

export async function findRelevantClassificationsSince(
  quantId: string,
  since: Date
) {
  return prisma.classifiedTweet.findMany({
    where: {
      tweet: { quantId },
      category: { not: "noise" },
      classifiedAt: { gt: since },
    },
    include: { tweet: true },
    orderBy: { classifiedAt: "asc" },
  });
}
