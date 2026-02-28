import type { Prisma } from "@repo/database";
import type { Allocation, ImpactType } from "@repo/shared";
import { logger } from "../utils/logger.js";
import * as classificationRepo from "../store/classification.repository.js";
import * as tweetImpactRepo from "../store/tweet-impact.repository.js";

const IMPACT_TYPE_WEIGHTS: Record<ImpactType, number> = {
  new_position: 30,
  exit: 25,
  increase: 20,
  decrease: 20,
  reinforcement: 5,
};

const CONVICTION_MULTIPLIERS: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const CATEGORY_MULTIPLIERS: Record<string, number> = {
  investment_call: 1.5,
  thesis_update: 1.3,
  market_analysis: 1.0,
};

function computeEngagementScore(tweet: {
  viewsCount: number;
  favoriteCount: number;
  retweetCount: number;
  bookmarkCount: number;
}): number {
  const raw =
    tweet.viewsCount * 0.1 +
    tweet.favoriteCount * 1 +
    tweet.retweetCount * 3 +
    tweet.bookmarkCount * 5;
  return raw > 0 ? Math.log10(raw + 1) / Math.log10(100_000) : 0;
}

function determineImpactType(
  asset: string,
  oldMap: Map<string, number>,
  newMap: Map<string, number>
): { impactType: ImpactType; delta: number } {
  const oldPct = oldMap.get(asset) ?? 0;
  const newPct = newMap.get(asset) ?? 0;
  const delta = Math.abs(newPct - oldPct);

  if (oldPct === 0 && newPct > 0) return { impactType: "new_position", delta };
  if (oldPct > 0 && newPct === 0) return { impactType: "exit", delta };
  if (newPct > oldPct) return { impactType: "increase", delta };
  if (newPct < oldPct) return { impactType: "decrease", delta };
  return { impactType: "reinforcement", delta: 0 };
}

export async function computeTweetImpacts({
  kolId,
  snapshotId,
  sourceTweetIds,
  oldAllocations,
  newAllocations,
}: {
  kolId: string;
  snapshotId: string;
  sourceTweetIds: string[];
  oldAllocations: Allocation[] | null;
  newAllocations: Allocation[];
}): Promise<number> {
  if (sourceTweetIds.length === 0) return 0;

  const oldMap = new Map<string, number>();
  if (oldAllocations) {
    for (const a of oldAllocations) {
      oldMap.set(a.asset, a.percentage);
    }
  }

  const newMap = new Map<string, number>();
  for (const a of newAllocations) {
    newMap.set(a.asset, a.percentage);
  }

  const classifications =
    await classificationRepo.findClassificationsByTweetIds(sourceTweetIds);

  if (classifications.length === 0) {
    logger.info({ kolId }, "No classifications found for source tweets, skipping impact computation");
    return 0;
  }

  const impactRecords: Prisma.TweetImpactCreateManyInput[] = [];

  for (const classification of classifications) {
    const { tweet } = classification;
    const assets = classification.assets;
    if (assets.length === 0) continue;

    const engagementScore = computeEngagementScore(tweet);

    for (const asset of assets) {
      if (asset === "USDC") continue;

      const { impactType, delta } = determineImpactType(asset, oldMap, newMap);

      const baseWeight = IMPACT_TYPE_WEIGHTS[impactType];
      const deltaContribution = Math.min(delta / 100, 1) * 25;
      const engagementContribution = engagementScore * 10;
      const rawScore = baseWeight + deltaContribution + engagementContribution;

      const convictionMul =
        CONVICTION_MULTIPLIERS[classification.conviction ?? "low"] ?? 1;
      const categoryMul =
        CATEGORY_MULTIPLIERS[classification.category] ?? 1.0;

      const significanceScore =
        rawScore * (convictionMul / 3) * categoryMul;

      impactRecords.push({
        tweetId: tweet.id,
        kolId,
        snapshotId,
        assets: [asset],
        impactType,
        allocationDelta: delta,
        conviction: classification.conviction ?? "low",
        sentiment: classification.sentiment ?? "neutral",
        category: classification.category,
        engagementScore,
        significanceScore,
      });
    }
  }

  if (impactRecords.length === 0) return 0;

  const result = await tweetImpactRepo.createTweetImpacts(impactRecords);

  logger.info(
    { kolId, snapshotId, impactsCreated: result.count },
    "Tweet impacts computed and saved"
  );

  return result.count;
}
