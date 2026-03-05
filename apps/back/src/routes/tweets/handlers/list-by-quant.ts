import type { FastifyReply, FastifyRequest } from "fastify";
import type { Tweet } from "@repo/database";
import * as quantRepo from "../../../store/quant.repository.js";
import * as tweetRepo from "../../../store/tweet.repository.js";

type ListByQuantRequest = FastifyRequest<{
  Params: { quantId: string };
  Querystring: {
    limit?: string;
    offset?: string;
    from?: string;
    to?: string;
  };
}>;

export async function listTweetsByQuant(
  request: ListByQuantRequest,
  reply: FastifyReply
): Promise<{ error: string } | { quantId: string; username: string | null; tweets: Tweet[]; total: number; limit: number; offset: number }> {
  const quant = await quantRepo.findQuantById(request.params.quantId);
  if (!quant) {
    return reply.status(404).send({ error: "Quant not found" });
  }

  const limit = Math.min(parseInt(request.query.limit ?? "50", 10) || 50, 100);
  const offset = parseInt(request.query.offset ?? "0", 10) || 0;
  const from = request.query.from ? new Date(request.query.from) : undefined;
  const to = request.query.to ? new Date(request.query.to) : undefined;

  const result = await tweetRepo.findTweetsByQuant({
    quantId: quant.id,
    limit,
    offset,
    from,
    to,
  });

  return {
    quantId: quant.id,
    username: quant.user.twitterUsername,
    tweets: result.tweets,
    total: result.total,
    limit,
    offset,
  };
}
