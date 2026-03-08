import type { FastifyReply, FastifyRequest } from "fastify";
import * as quantRepo from "../../../store/quant.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";
import * as classificationRepo from "../../../store/classification.repository.js";
import { classifyUnclassifiedTweets } from "../../../services/classifier.service.js";
import { synthesizeThesis } from "../../../services/thesis.service.js";

type InstantRunAlgoRequest = FastifyRequest<{
  Params: { quantId: string };
  Querystring: { force?: string };
}>;

export async function instantRunAlgo(
  request: InstantRunAlgoRequest,
  reply: FastifyReply,
): Promise<unknown> {
  const quant = await quantRepo.findQuantById(request.params.quantId);
  if (!quant) return reply.status(404).send({ error: "Quant not found" });

  const force = request.query.force === "true";
  let deletedSnapshots = 0;
  let deletedClassifications = 0;

  if (force) {
    deletedClassifications = await classificationRepo.deleteAllClassifications(quant.id);
    deletedSnapshots = await portfolioRepo.deleteAllSnapshots(quant.id);
  }

  const classified = await classifyUnclassifiedTweets(quant.id);
  const result = await synthesizeThesis(quant.id);

  return { quantId: quant.id, username: quant.user.twitterUsername, classified, didUpdate: result.updated, force, deletedSnapshots, deletedClassifications };
}
