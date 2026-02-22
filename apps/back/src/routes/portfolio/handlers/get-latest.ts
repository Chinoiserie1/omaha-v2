import type { FastifyReply, FastifyRequest } from "fastify";
import type { PortfolioSnapshot } from "@repo/database";
import * as kolRepo from "../../../store/kol.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";

type GetLatestRequest = FastifyRequest<{
  Params: { kolId: string };
}>;

export async function getLatestPortfolio(
  request: GetLatestRequest,
  reply: FastifyReply
): Promise<{ error: string } | { kolId: string; username: string; snapshot: PortfolioSnapshot }> {
  const kol = await kolRepo.findKolById(request.params.kolId);
  if (!kol) {
    return reply.status(404).send({ error: "KOL not found" });
  }

  const snapshot = await portfolioRepo.findLatestSnapshot(kol.id);
  if (!snapshot) {
    return reply.status(404).send({ error: "No portfolio snapshot yet" });
  }

  return {
    kolId: kol.id,
    username: kol.username,
    snapshot,
  };
}
