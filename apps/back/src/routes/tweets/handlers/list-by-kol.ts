import type { FastifyReply, FastifyRequest } from "fastify";
import type { Tweet } from "@repo/database";
import * as kolRepo from "../../../store/kol.repository.js";
import * as tweetRepo from "../../../store/tweet.repository.js";

type ListByKolRequest = FastifyRequest<{
  Params: { kolId: string };
  Querystring: {
    limit?: string;
    offset?: string;
    from?: string;
    to?: string;
  };
}>;

export async function listTweetsByKol(
  request: ListByKolRequest,
  reply: FastifyReply
): Promise<{ error: string } | { kolId: string; username: string; tweets: Tweet[]; total: number; limit: number; offset: number }> {
  const kol = await kolRepo.findKolById(request.params.kolId);
  if (!kol) {
    return reply.status(404).send({ error: "KOL not found" });
  }

  const limit = Math.min(parseInt(request.query.limit ?? "50", 10) || 50, 100);
  const offset = parseInt(request.query.offset ?? "0", 10) || 0;
  const from = request.query.from ? new Date(request.query.from) : undefined;
  const to = request.query.to ? new Date(request.query.to) : undefined;

  const result = await tweetRepo.findTweetsByKol({
    kolId: kol.id,
    limit,
    offset,
    from,
    to,
  });

  return {
    kolId: kol.id,
    username: kol.username,
    tweets: result.tweets,
    total: result.total,
    limit,
    offset,
  };
}
