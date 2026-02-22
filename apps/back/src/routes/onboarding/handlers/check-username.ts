import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { checkUsernameSchema, type ApiResponse } from "@repo/shared";

type CheckUsernameRequest = FastifyRequest<{
  Body: { username: string };
}>;

export async function checkUsername(
  request: CheckUsernameRequest,
  reply: FastifyReply
): Promise<ApiResponse<{ available: boolean }> | ApiResponse<never>> {
  const result = checkUsernameSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      success: false,
      error: result.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const existing = await prisma.user.findUnique({
    where: { username: result.data.username },
  });

  return {
    success: true,
    data: { available: !existing },
  } satisfies ApiResponse<{ available: boolean }>;
}
