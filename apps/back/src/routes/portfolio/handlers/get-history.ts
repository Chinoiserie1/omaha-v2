import type { FastifyReply, FastifyRequest } from "fastify";
import type { PortfolioSnapshot } from "@repo/database";
import * as quantRepo from "../../../store/quant.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";

type GetHistoryRequest = FastifyRequest<{
  Params: { quantId: string };
  Querystring: { limit?: string };
}>;

export async function getPortfolioHistory(
  request: GetHistoryRequest,
  reply: FastifyReply
): Promise<{ error: string } | { quantId: string; username: string | null; snapshots: PortfolioSnapshot[]; count: number }> {
  const quant = await quantRepo.findQuantById(request.params.quantId);
  if (!quant) {
    return reply.status(404).send({ error: "Quant not found" });
  }

  const limit = Math.min(
    parseInt(request.query.limit ?? "50", 10) || 50,
    100
  );
  const snapshots = await portfolioRepo.findSnapshotHistory(quant.id, limit);

  return {
    quantId: quant.id,
    username: quant.user.twitterUsername,
    snapshots,
    count: snapshots.length,
  };
}
