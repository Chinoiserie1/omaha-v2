import type { FastifyReply, FastifyRequest } from "fastify";
import { exploreSearchQuerySchema } from "@repo/shared";
import type { ExploreSignal, ExploreSearchResponse } from "@repo/shared";
import * as tweetImpactRepo from "../../../store/tweet-impact.repository.js";

const CONVICTION_MULTIPLIER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export async function searchSignals(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = exploreSearchQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    });
  }

  const { asset, limit, offset } = parsed.data;

  const { impacts } = await tweetImpactRepo.findSignificantTweetsCrossQuant({
    asset: asset.toUpperCase(),
    limit,
  });

  const scored: ExploreSignal[] = impacts.map((impact) => {
    const followerCount = impact.quant.user.twitterFollowerCount ?? 0;
    const multiplier = CONVICTION_MULTIPLIER[impact.conviction] ?? 1;
    const popularityScore = followerCount * multiplier;

    return {
      quant: {
        id: impact.quant.id,
        username: impact.quant.user.twitterUsername,
        avatarUrl: impact.quant.user.profileImageUrl,
        followerCount: impact.quant.user.twitterFollowerCount,
      },
      tweet: {
        tweetId: impact.tweet.tweetId,
        fullText: impact.tweet.fullText,
        postedAt: impact.tweet.postedAt.toISOString(),
        favoriteCount: impact.tweet.favoriteCount,
        retweetCount: impact.tweet.retweetCount,
        replyCount: impact.tweet.replyCount,
        viewsCount: impact.tweet.viewsCount,
      },
      impact: {
        assets: impact.assets,
        conviction: impact.conviction,
        sentiment: impact.sentiment,
        impactType: impact.impactType,
        category: impact.category,
        allocationDelta: impact.allocationDelta,
        significanceScore: impact.significanceScore,
      },
      popularityScore,
    };
  });

  scored.sort((a, b) => b.popularityScore - a.popularityScore);

  // Deduplicate by tweetId, keeping highest-scored entry
  const seen = new Set<string>();
  const deduped = scored.filter((s) => {
    if (seen.has(s.tweet.tweetId)) return false;
    seen.add(s.tweet.tweetId);
    return true;
  });

  const paginated = deduped.slice(offset, offset + limit);

  const response: ExploreSearchResponse = {
    results: paginated,
    total: deduped.length,
    asset: asset.toUpperCase(),
    limit,
    offset,
  };

  return response;
}
