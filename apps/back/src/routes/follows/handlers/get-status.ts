import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { followStatusQuerySchema, type ApiResponse, type FollowStatus } from "@repo/shared";

type StatusRequest = FastifyRequest<{ Querystring: { targetUserId: string } }>;

export async function getFollowStatus(
  request: StatusRequest,
  reply: FastifyReply
): Promise<ApiResponse<FollowStatus> | ApiResponse<never>> {
  const queryResult = followStatusQuerySchema.safeParse(request.query);

  if (!queryResult.success) {
    return reply.status(400).send({
      success: false,
      error: queryResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const follower = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });

  if (!follower) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  const follow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: follower.id,
        followingId: queryResult.data.targetUserId,
      },
    },
  });

  return {
    success: true,
    data: { isFollowing: !!follow },
  } satisfies ApiResponse<FollowStatus>;
}
