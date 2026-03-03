import type { FastifyReply, FastifyRequest } from "fastify";
import * as kolRepo from "../../../store/kol.repository.js";
import { classifyUnclassifiedTweets } from "../../../services/classifier.service.js";
import { synthesizeThesis } from "../../../services/thesis.service.js";

type InstantRunAlgoRequest = FastifyRequest<{ Params: { kolId: string } }>;

export async function instantRunAlgo(
  request: InstantRunAlgoRequest,
  reply: FastifyReply
) {
  const kol = await kolRepo.findKolById(request.params.kolId);
  if (!kol) return reply.status(404).send({ error: "KOL not found" });

  const classified = await classifyUnclassifiedTweets(kol.id);
  const didUpdate = await synthesizeThesis(kol.id);

  return { kolId: kol.id, username: kol.username, classified, didUpdate };
}
