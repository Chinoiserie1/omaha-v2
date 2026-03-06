import type { FastifyReply, FastifyRequest } from "fastify";
import * as kolRepo from "../../../store/kol.repository.js";

type GetRequest = FastifyRequest<{
  Params: { id: string };
}>;

export async function getKol(
  request: GetRequest,
  reply: FastifyReply,
): Promise<unknown> {
  const kol = await kolRepo.findKolWithTweets(request.params.id, 50);

  if (!kol) {
    return reply.status(404).send({ error: "KOL not found" });
  }

  return kol;
}
