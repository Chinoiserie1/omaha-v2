import type { FastifyInstance } from "fastify";
import { createTweet } from "./handlers/create.js";
import { listTweetsByQuant } from "./handlers/list-by-quant.js";
import { listSignificantTweets } from "./handlers/list-significant.js";
import { getThread } from "./handlers/get-thread.js";

export async function tweetRoutes(app: FastifyInstance) {
  app.post("/", createTweet);
}

export async function quantTweetRoutes(app: FastifyInstance) {
  app.get("/:quantId/tweets/significant", listSignificantTweets);
  app.get("/:quantId/tweets", listTweetsByQuant);
  app.get("/:quantId/threads/:conversationId", getThread);
}
