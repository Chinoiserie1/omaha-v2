import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { idParamSchema, type ApiResponse, type User } from "@repo/shared";

type GetRequest = FastifyRequest<{
  Params: { id: string };
}>;

export async function getUser(
  request: GetRequest,
  reply: FastifyReply
): Promise<ApiResponse<User> | ApiResponse<never>> {
  const paramsResult = idParamSchema.safeParse(request.params);

  if (!paramsResult.success) {
    return reply.status(400).send({
      success: false,
      error: paramsResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const user = await prisma.user.findUnique({
    where: { id: paramsResult.data.id },
  });

  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  return { success: true, data: user } satisfies ApiResponse<User>;
}
