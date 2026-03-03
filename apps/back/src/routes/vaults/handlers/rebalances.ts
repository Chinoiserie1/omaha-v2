import type { FastifyReply, FastifyRequest } from "fastify";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as rebalanceRepo from "../../../store/rebalance.repository.js";
import { logger } from "../../../utils/logger.js";

type GetRebalancesRequest = FastifyRequest<{
  Params: { id: string };
  Querystring: { limit?: string };
}>;

export async function getRebalances(
  request: GetRebalancesRequest,
  reply: FastifyReply,
) {
  logger.info("AAA");
  const vault = await vaultRepo.findVaultById(request.params.id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }

  const limit = Math.min(Math.max(1, Number(request.query.limit) || 10), 50);

  const events = await rebalanceRepo.findByVaultWithSnapshots(vault.id, limit);

  return events.map((event) => {
    const topImpact = event.snapshot.tweetImpacts[0] ?? null;

    return {
      id: event.id,
      status: event.status,
      sellCount: event.sellCount,
      buyCount: event.buyCount,
      totalSwaps: event.totalSwaps,
      vaultEquityUsd: event.vaultEquityUsd,
      startedAt: event.startedAt,
      completedAt: event.completedAt,
      snapshot: {
        id: event.snapshot.id,
        thesisSummary: event.snapshot.thesisSummary,
        changes: event.snapshot.changes,
        createdAt: event.snapshot.createdAt,
        topTweet: topImpact
          ? {
              id: topImpact.id,
              assets: topImpact.assets,
              impactType: topImpact.impactType,
              conviction: topImpact.conviction,
              sentiment: topImpact.sentiment,
              significanceScore: topImpact.significanceScore,
              tweet: topImpact.tweet,
            }
          : null,
      },
    };
  });
}
