import type { FastifyReply, FastifyRequest } from "fastify";
import * as quantRepo from "../../../store/quant.repository.js";

type ListRequest = FastifyRequest<{
  Querystring: { all?: string };
}>;

export async function listQuants(
  request: ListRequest,
  _reply: FastifyReply
) {
  const includeAll = request.query.all === "true";
  const quants = await quantRepo.findAllQuants(!includeAll);

  return quants.map((quant) => ({
    id: quant.id,
    username: quant.user.twitterUsername,
    followersCount: quant.user.twitterFollowerCount,
    avatarUrl: quant.user.profileImageUrl,
    bio: quant.user.bio,
    isActive: quant.isActive,
    lastFetchedAt: quant.lastFetchedAt,
    tweetCount: quant._count.tweets,
    createdAt: quant.createdAt,
    updatedAt: quant.updatedAt,
  }));
}
