import type { FastifyReply, FastifyRequest } from "fastify";
import type { PortfolioSnapshot } from "@repo/database";
import * as quantRepo from "../../../store/quant.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";

type GetLatestRequest = FastifyRequest<{
  Params: { quantId: string };
}>;

export async function getLatestPortfolio(
  request: GetLatestRequest,
  reply: FastifyReply
): Promise<{ error: string } | { quantId: string; username: string | null; snapshot: PortfolioSnapshot }> {
  const quant = await quantRepo.findQuantById(request.params.quantId);
  if (!quant) {
    return reply.status(404).send({ error: "Quant not found" });
  }

  const snapshot = await portfolioRepo.findLatestSnapshot(quant.id);
  if (!snapshot) {
    return reply.status(404).send({ error: "No portfolio snapshot yet" });
  }

  return {
    quantId: quant.id,
    username: quant.user.twitterUsername,
    snapshot,
  };
}
