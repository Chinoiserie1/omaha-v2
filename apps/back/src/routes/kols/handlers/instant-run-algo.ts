import type { FastifyReply, FastifyRequest } from "fastify";
import * as kolRepo from "../../../store/kol.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";
import * as classificationRepo from "../../../store/classification.repository.js";
import { classifyUnclassifiedTweets } from "../../../services/classifier.service.js";
import { synthesizeThesis } from "../../../services/thesis.service.js";

type InstantRunAlgoRequest = FastifyRequest<{
  Params: { kolId: string };
  Querystring: { force?: string };
}>;

export async function instantRunAlgo(
  request: InstantRunAlgoRequest,
  reply: FastifyReply,
): Promise<unknown> {
  const kol = await kolRepo.findKolById(request.params.kolId);
  if (!kol) return reply.status(404).send({ error: "KOL not found" });

  const force = request.query.force === "true";
  let deletedSnapshots = 0;
  let deletedClassifications = 0;

  if (force) {
    deletedClassifications = await classificationRepo.deleteAllClassifications(kol.id);
    deletedSnapshots = await portfolioRepo.deleteAllSnapshots(kol.id);
  }

  const classified = await classifyUnclassifiedTweets(kol.id);
  const didUpdate = await synthesizeThesis(kol.id);

  return { kolId: kol.id, username: kol.username, classified, didUpdate, force, deletedSnapshots, deletedClassifications };
}
