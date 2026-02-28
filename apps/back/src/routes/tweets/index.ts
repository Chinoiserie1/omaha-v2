import type { FastifyInstance } from "fastify";
import { createTweet } from "./handlers/create.js";
import { listTweetsByKol } from "./handlers/list-by-kol.js";
import { listSignificantTweets } from "./handlers/list-significant.js";
import { getThread } from "./handlers/get-thread.js";

export async function tweetRoutes(app: FastifyInstance) {
  app.post("/", createTweet);
}

export async function kolTweetRoutes(app: FastifyInstance) {
  app.get("/:kolId/tweets/significant", listSignificantTweets);
  app.get("/:kolId/tweets", listTweetsByKol);
  app.get("/:kolId/threads/:conversationId", getThread);
}
