import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { registerPushTokenSchema, type ApiResponse } from "@repo/shared";
import { upsertToken } from "../../../store/push-token.repository.js";

type RegisterRequest = FastifyRequest<{
  Body: { token: string; platform?: string };
}>;

export async function registerPushToken(
  request: RegisterRequest,
  reply: FastifyReply,
): Promise<ApiResponse<{ registered: boolean }> | ApiResponse<never>> {
  const bodyResult = registerPushTokenSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      success: false,
      error: bodyResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });

  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  await upsertToken(user.id, bodyResult.data.token, bodyResult.data.platform);

  return { success: true, data: { registered: true } };
}
