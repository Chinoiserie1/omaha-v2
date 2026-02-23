import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { followCountsQuerySchema, type ApiResponse, type FollowCounts } from "@repo/shared";

type CountsRequest = FastifyRequest<{ Querystring: { userId: string } }>;

export async function getFollowCounts(
  request: CountsRequest,
  reply: FastifyReply
): Promise<ApiResponse<FollowCounts> | ApiResponse<never>> {
  const queryResult = followCountsQuerySchema.safeParse(request.query);

  if (!queryResult.success) {
    return reply.status(400).send({
      success: false,
      error: queryResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const counts = await prisma.user.findUnique({
    where: { id: queryResult.data.userId },
    select: {
      _count: {
        select: { followers: true, following: true },
      },
    },
  });

  if (!counts) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  return {
    success: true,
    data: {
      followersCount: counts._count.followers,
      followingCount: counts._count.following,
    },
  } satisfies ApiResponse<FollowCounts>;
}
