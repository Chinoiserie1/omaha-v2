import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse, User, FollowCounts } from "@repo/shared";

type ProfileResponse = User & FollowCounts;

export async function getMyProfile(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ApiResponse<ProfileResponse> | ApiResponse<never>> {
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
    include: {
      _count: {
        select: { followers: true, following: true },
      },
    },
  });

  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  const { _count, ...userData } = user;

  return {
    success: true,
    data: {
      ...userData,
      followersCount: _count.followers,
      followingCount: _count.following,
    },
  } satisfies ApiResponse<ProfileResponse>;
}
