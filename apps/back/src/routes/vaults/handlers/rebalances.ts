import type { FastifyReply, FastifyRequest } from "fastify";
import { paginationSchema, type PaginatedResponse } from "@repo/shared";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as rebalanceRepo from "../../../store/rebalance.repository.js";

export async function getRebalances(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const vault = await vaultRepo.findVaultById(request.params.id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }

  const parsed = paginationSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    });
  }

  const { page, pageSize } = parsed.data;
  const skip = (page - 1) * pageSize;

  const { events, total } = await rebalanceRepo.findByVaultWithSnapshotsPaginated(
    vault.id,
    skip,
    pageSize,
  );

  const items = events.map((event) => {
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

  const response: PaginatedResponse<(typeof items)[number]> = {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };

  return response;
}
