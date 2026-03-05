import type { FastifyReply, FastifyRequest } from "fastify";
import type { Tweet } from "@repo/database";
import * as quantRepo from "../../../store/quant.repository.js";
import * as tweetRepo from "../../../store/tweet.repository.js";

type GetThreadRequest = FastifyRequest<{
  Params: { quantId: string; conversationId: string };
}>;

export async function getThread(
  request: GetThreadRequest,
  reply: FastifyReply
): Promise<{ error: string } | { quantId: string; username: string | null; conversationId: string; tweets: Tweet[]; length: number }> {
  const quant = await quantRepo.findQuantById(request.params.quantId);
  if (!quant) {
    return reply.status(404).send({ error: "Quant not found" });
  }

  const tweets = await tweetRepo.findThreadByConversationId(
    request.params.conversationId
  );

  // Filter to only tweets belonging to this Quant
  const quantTweets = tweets.filter((t) => t.quantId === quant.id);

  if (quantTweets.length === 0) {
    return reply.status(404).send({ error: "Thread not found" });
  }

  return {
    quantId: quant.id,
    username: quant.user.twitterUsername,
    conversationId: request.params.conversationId,
    tweets: quantTweets,
    length: quantTweets.length,
  };
}
