import type { FastifyReply, FastifyRequest } from "fastify";
import { significantTweetsQuerySchema } from "@repo/shared";
import * as kolRepo from "../../../store/kol.repository.js";
import * as tweetImpactRepo from "../../../store/tweet-impact.repository.js";

type ListSignificantRequest = FastifyRequest<{
  Params: { kolId: string };
  Querystring: {
    limit?: string;
    offset?: string;
    asset?: string;
    impactType?: string;
    minScore?: string;
  };
}>;

export async function listSignificantTweets(
  request: ListSignificantRequest,
  reply: FastifyReply
) {
  const kol = await kolRepo.findKolById(request.params.kolId);
  if (!kol) {
    return reply.status(404).send({ error: "KOL not found" });
  }

  const parsed = significantTweetsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const { limit, offset, asset, impactType, minScore } = parsed.data;

  const result = await tweetImpactRepo.findSignificantTweets({
    kolId: kol.id,
    limit,
    offset,
    asset,
    impactType,
    minScore,
  });

  return {
    kolId: kol.id,
    username: kol.username,
    significantTweets: result.impacts,
    total: result.total,
    limit,
    offset,
  };
}
