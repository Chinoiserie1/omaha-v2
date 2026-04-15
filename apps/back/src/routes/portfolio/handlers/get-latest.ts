import type { FastifyReply, FastifyRequest } from "fastify";
import * as quantRepo from "../../../store/quant.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";
import { getLogoUriByMints } from "../../../store/asset.repository.js";
import { allocationRowsToAllocations } from "../../../utils/snapshot-converters.js";

type GetLatestRequest = FastifyRequest<{
  Params: { quantId: string };
}>;

export async function getLatestPortfolio(
  request: GetLatestRequest,
  reply: FastifyReply,
) {
  const quant = await quantRepo.findQuantById(request.params.quantId);
  if (!quant) {
    return reply.status(404).send({ error: "Quant not found" });
  }

  const snapshot = await portfolioRepo.findLatestSnapshot(quant.id);
  if (!snapshot) {
    return reply.status(404).send({ error: "No portfolio snapshot yet" });
  }

  // Enrich allocations with token logo URIs
  const allocations = allocationRowsToAllocations(snapshot.allocationRows);
  const mints = allocations
    .map((a) => a.mint)
    .filter((m): m is string => !!m);
  const logoMap = await getLogoUriByMints(mints);
  const enrichedAllocations = allocations.map((a) => ({
    ...a,
    logoUri: a.mint ? (logoMap.get(a.mint) ?? null) : null,
  }));

  return {
    quantId: quant.id,
    username: quant.user.twitterUsername,
    snapshot: {
      id: snapshot.id,
      quantId: snapshot.quantId,
      thesisSummary: snapshot.thesisSummary,
      allocations: enrichedAllocations,
      changes: snapshot.changes,
      sourceTweetIds: snapshot.sourceTweetIds,
      createdAt: snapshot.createdAt,
    },
  };
}
