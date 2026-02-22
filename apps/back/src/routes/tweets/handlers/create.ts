import type { FastifyReply, FastifyRequest } from "fastify";
import type { Tweet } from "@repo/database";
import * as kolService from "../../../services/kol.service.js";

type CreateRequest = FastifyRequest<{
  Body: { url: string };
}>;

export async function createTweet(
  request: CreateRequest,
  reply: FastifyReply
): Promise<{ error: string } | { kol: { id: string; username: string }; tweet: Tweet }> {
  const { url } = request.body ?? {};
  if (!url || typeof url !== "string") {
    return reply.status(400).send({ error: "Missing required field: url" });
  }

  try {
    const { kol, tweet } = await kolService.addTweetByUrl(url);
    return {
      kol: { id: kol.id, username: kol.username },
      tweet,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Invalid tweet URL")) {
      return reply.status(400).send({ error: message });
    }
    if (message.includes("not found on Twitter")) {
      return reply.status(404).send({ error: message });
    }
    throw error;
  }
}
