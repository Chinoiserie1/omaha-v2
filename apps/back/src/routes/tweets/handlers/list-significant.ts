import type { FastifyReply, FastifyRequest } from "fastify";
import { significantTweetsQuerySchema } from "@repo/shared";
import * as quantRepo from "../../../store/quant.repository.js";
import * as tweetImpactRepo from "../../../store/tweet-impact.repository.js";

type ListSignificantRequest = FastifyRequest<{
  Params: { quantId: string };
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
  const quant = await quantRepo.findQuantById(request.params.quantId);
  if (!quant) {
    return reply.status(404).send({ error: "Quant not found" });
  }

  const parsed = significantTweetsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const { limit, offset, asset, impactType, minScore } = parsed.data;

  const result = await tweetImpactRepo.findSignificantTweets({
    quantId: quant.id,
    limit,
    offset,
    asset,
    impactType,
    minScore,
  });

  return {
    quantId: quant.id,
    username: quant.user.twitterUsername,
    significantTweets: result.impacts,
    total: result.total,
    limit,
    offset,
  };
}
