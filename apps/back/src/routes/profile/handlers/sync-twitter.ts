import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { syncTwitterSchema, type ApiResponse, type User } from "@repo/shared";

export async function syncTwitter(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ApiResponse<User> | ApiResponse<never>> {
  const result = syncTwitterSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      success: false,
      error: result.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const { twitterId, twitterUsername, profileImageUrl, name } = result.data;

  const user = await prisma.user.update({
    where: { privyId: request.privyUserId },
    data: {
      twitterId,
      ...(twitterUsername !== undefined && { twitterUsername }),
      ...(profileImageUrl !== undefined && { profileImageUrl }),
      ...(name !== undefined && { name }),
    },
  });

  return { success: true, data: user } satisfies ApiResponse<User>;
}
