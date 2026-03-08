import type { FastifyReply, FastifyRequest } from "fastify";
import type { ExploreTrendingResponse } from "@repo/shared";
import * as tweetImpactRepo from "../../../store/tweet-impact.repository.js";
import * as quantRepo from "../../../store/quant.repository.js";
import { CURATED_ASSETS } from "../../../data/curated-assets.js";

const assetMap = new Map(
  CURATED_ASSETS.map((a) => [a.symbol, { name: a.name, category: a.category }]),
);

export async function getTrending(
  _request: FastifyRequest,
  _reply: FastifyReply,
) {
  const [rawAssets, rawQuants] = await Promise.all([
    tweetImpactRepo.findTrendingAssets(20),
    quantRepo.findTopQuants(10),
  ]);

  const trendingAssets = rawAssets
    .map((r) => {
      const info = assetMap.get(r.asset);
      if (!info) return null;
      return {
        symbol: r.asset,
        name: info.name,
        category: info.category,
        signalCount: r.signalCount,
        quantCount: r.quantCount,
        latestSignalAt: r.latestSignalAt.toISOString(),
      };
    })
    .filter((a) => a !== null);

  const topQuants = rawQuants.map((q) => ({
    id: q.id,
    username: q.user.twitterUsername ?? "unknown",
    displayName: q.user.name,
    avatarUrl: q.user.profileImageUrl,
    followerCount: q.user.twitterFollowerCount ?? 0,
    signalCount: q._count.tweetImpacts,
    vaultId: q.vault?.id ?? null,
  }));

  const response: ExploreTrendingResponse = { trendingAssets, topQuants };
  return response;
}
