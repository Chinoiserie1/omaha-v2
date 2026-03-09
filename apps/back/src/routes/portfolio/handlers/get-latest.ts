import type { FastifyReply, FastifyRequest } from "fastify";
import type { PortfolioSnapshot } from "@repo/database";
import * as quantRepo from "../../../store/quant.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";
import { getLogoUriByMints } from "../../../store/asset.repository.js";

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

  // Enrich allocations with token logo URIs
  const rawAllocations = snapshot.allocations as { mint?: string }[];
  const mints = rawAllocations
    .map((a) => a.mint)
    .filter((m): m is string => !!m);
  const logoMap = await getLogoUriByMints(mints);
  const enrichedAllocations = rawAllocations.map((a) => ({
    ...a,
    logoUri: a.mint ? logoMap.get(a.mint) ?? null : null,
  }));

  return {
    quantId: quant.id,
    username: quant.user.twitterUsername,
    snapshot: {
      ...snapshot,
      allocations: enrichedAllocations,
    },
  };
}
