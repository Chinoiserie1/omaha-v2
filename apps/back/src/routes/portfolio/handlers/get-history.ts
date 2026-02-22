import type { FastifyReply, FastifyRequest } from "fastify";
import type { PortfolioSnapshot } from "@repo/database";
import * as kolRepo from "../../../store/kol.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";

type GetHistoryRequest = FastifyRequest<{
  Params: { kolId: string };
  Querystring: { limit?: string };
}>;

export async function getPortfolioHistory(
  request: GetHistoryRequest,
  reply: FastifyReply
): Promise<{ error: string } | { kolId: string; username: string; snapshots: PortfolioSnapshot[]; count: number }> {
  const kol = await kolRepo.findKolById(request.params.kolId);
  if (!kol) {
    return reply.status(404).send({ error: "KOL not found" });
  }

  const limit = Math.min(
    parseInt(request.query.limit ?? "50", 10) || 50,
    100
  );
  const snapshots = await portfolioRepo.findSnapshotHistory(kol.id, limit);

  return {
    kolId: kol.id,
    username: kol.username,
    snapshots,
    count: snapshots.length,
  };
}
