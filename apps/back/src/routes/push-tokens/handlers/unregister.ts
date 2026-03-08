import type { FastifyReply, FastifyRequest } from "fastify";
import { registerPushTokenSchema, type ApiResponse } from "@repo/shared";
import { deleteToken } from "../../../store/push-token.repository.js";

type UnregisterRequest = FastifyRequest<{
  Body: { token: string };
}>;

export async function unregisterPushToken(
  request: UnregisterRequest,
  reply: FastifyReply,
): Promise<ApiResponse<{ unregistered: boolean }> | ApiResponse<never>> {
  const bodyResult = registerPushTokenSchema
    .pick({ token: true })
    .safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      success: false,
      error: bodyResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  await deleteToken(bodyResult.data.token);

  return { success: true, data: { unregistered: true } };
}
