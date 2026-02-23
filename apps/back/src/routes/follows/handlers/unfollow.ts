import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { unfollowUserSchema, type ApiResponse } from "@repo/shared";

type UnfollowRequest = FastifyRequest<{ Body: { followingId: string } }>;

export async function unfollowUser(
  request: UnfollowRequest,
  reply: FastifyReply
): Promise<ApiResponse<{ unfollowed: boolean }> | ApiResponse<never>> {
  const bodyResult = unfollowUserSchema.safeParse(request.body);

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

  await prisma.follow.deleteMany({
    where: {
      followerId: follower.id,
      followingId: bodyResult.data.followingId,
    },
  });

  return { success: true, data: { unfollowed: true } } satisfies ApiResponse<{ unfollowed: boolean }>;
}
