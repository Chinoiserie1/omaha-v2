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

export async function findUnclassifiedTweetsByKol(kolId: string) {
  return prisma.tweet.findMany({
    where: {
      kolId,
      classification: null,
    },
    orderBy: { postedAt: "asc" },
  });
}

export async function findRelevantClassificationsSince(
  kolId: string,
  since: Date
) {
  return prisma.classifiedTweet.findMany({
    where: {
      tweet: { kolId },
      category: { not: "noise" },
      classifiedAt: { gt: since },
    },
    include: { tweet: true },
    orderBy: { classifiedAt: "asc" },
  });
}
