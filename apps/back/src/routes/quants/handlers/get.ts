import type { FastifyReply, FastifyRequest } from "fastify";
import * as quantRepo from "../../../store/quant.repository.js";

type GetRequest = FastifyRequest<{
  Params: { id: string };
}>;

export async function getQuant(
  request: GetRequest,
  reply: FastifyReply,
): Promise<unknown> {
  const quant = await quantRepo.findQuantWithTweets(request.params.id, 50);

  if (!quant) {
    return reply.status(404).send({ error: "Quant not found" });
  }

  return quant;
}
