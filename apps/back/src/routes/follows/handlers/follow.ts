import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { followUserSchema, type ApiResponse, type Follow } from "@repo/shared";

type FollowRequest = FastifyRequest<{ Body: { followingId: string } }>;

export async function followUser(
  request: FollowRequest,
  reply: FastifyReply
): Promise<ApiResponse<Follow> | ApiResponse<never>> {
  const bodyResult = followUserSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      success: false,
      error: bodyResult.error.errors.map((e) => e.message).join(", "),
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

  if (follower.id === bodyResult.data.followingId) {
    return reply.status(400).send({
      success: false,
      error: "Cannot follow yourself",
    } satisfies ApiResponse<never>);
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: bodyResult.data.followingId },
  });

  if (!targetUser) {
    return reply.status(404).send({
      success: false,
      error: "Target user not found",
    } satisfies ApiResponse<never>);
  }

  const follow = await prisma.follow.upsert({
    where: {
      followerId_followingId: {
        followerId: follower.id,
        followingId: bodyResult.data.followingId,
      },
    },
    create: {
      followerId: follower.id,
      followingId: bodyResult.data.followingId,
    },
    update: {},
  });

  return reply.status(201).send({
    success: true,
    data: follow,
  } satisfies ApiResponse<Follow>);
}
