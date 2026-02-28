import type { FastifyReply, FastifyRequest } from "fastify";
import * as kolRepo from "../../../store/kol.repository.js";

type ListRequest = FastifyRequest<{
  Querystring: { all?: string };
}>;

export async function listKols(
  request: ListRequest,
  _reply: FastifyReply
) {
  const includeAll = request.query.all === "true";
  const kols = await kolRepo.findAllKols(!includeAll);

  return kols.map((kol) => ({
    id: kol.id,
    username: kol.username,
    displayName: kol.displayName,
    restId: kol.restId,
    followersCount: kol.followersCount,
    avatarUrl: kol.avatarUrl,
    bio: kol.bio,
    isActive: kol.isActive,
    lastFetchedAt: kol.lastFetchedAt,
    tweetCount: kol._count.tweets,
    createdAt: kol.createdAt,
    updatedAt: kol.updatedAt,
  }));
}
