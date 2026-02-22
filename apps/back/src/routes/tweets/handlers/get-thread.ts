import type { FastifyReply, FastifyRequest } from "fastify";
import type { Tweet } from "@repo/database";
import * as kolRepo from "../../../store/kol.repository.js";
import * as tweetRepo from "../../../store/tweet.repository.js";

type GetThreadRequest = FastifyRequest<{
  Params: { kolId: string; conversationId: string };
}>;

export async function getThread(
  request: GetThreadRequest,
  reply: FastifyReply
): Promise<{ error: string } | { kolId: string; username: string; conversationId: string; tweets: Tweet[]; length: number }> {
  const kol = await kolRepo.findKolById(request.params.kolId);
  if (!kol) {
    return reply.status(404).send({ error: "KOL not found" });
  }

  const tweets = await tweetRepo.findThreadByConversationId(
    request.params.conversationId
  );

  // Filter to only tweets belonging to this KOL
  const kolTweets = tweets.filter((t) => t.kolId === kol.id);

  if (kolTweets.length === 0) {
    return reply.status(404).send({ error: "Thread not found" });
  }

  return {
    kolId: kol.id,
    username: kol.username,
    conversationId: request.params.conversationId,
    tweets: kolTweets,
    length: kolTweets.length,
  };
}
