import type { FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { ingestContentSchema } from "@repo/shared";
import * as kolRepo from "../../../store/kol.repository.js";
import * as tweetRepo from "../../../store/tweet.repository.js";

export async function ingestContent(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parsed = ingestContentSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: parsed.error.errors.map((e) => e.message).join(", "),
    });
  }

  const { kolId, kolUsername, text, source, sourceUrl, postedAt } = parsed.data;

  const kol = kolId
    ? await kolRepo.findKolById(kolId)
    : await kolRepo.findKolByUsername(kolUsername!);

  if (!kol) {
    return reply.status(404).send({ error: "KOL not found" });
  }

  const tweetId = `ext-${crypto.randomUUID().replace(/-/g, "")}`;

  const tweet = await tweetRepo.upsertTweet({
    tweetId,
    kolId: kol.id,
    fullText: text,
    postedAt: postedAt ?? new Date(),
    favoriteCount: 0,
    retweetCount: 0,
    replyCount: 0,
    bookmarkCount: 0,
    viewsCount: 0,
    isRetweet: false,
    isReply: false,
    isThread: false,
    source,
    ...(sourceUrl ? { sourceUrl } : {}),
  });

  return reply.status(201).send(tweet);
}
