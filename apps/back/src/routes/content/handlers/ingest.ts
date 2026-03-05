import type { FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { ingestContentSchema } from "@repo/shared";
import * as quantRepo from "../../../store/quant.repository.js";
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

  const { quantId, quantUsername, text, source, sourceUrl, postedAt } = parsed.data;

  const quant = quantId
    ? await quantRepo.findQuantById(quantId)
    : await quantRepo.findQuantByUsername(quantUsername!);

  if (!quant) {
    return reply.status(404).send({ error: "Quant not found" });
  }

  const tweetId = `ext-${crypto.randomUUID().replace(/-/g, "")}`;

  const tweet = await tweetRepo.upsertTweet({
    tweetId,
    quantId: quant.id,
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
