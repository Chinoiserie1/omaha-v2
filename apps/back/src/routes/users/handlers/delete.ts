import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { idParamSchema, type ApiResponse } from "@repo/shared";

type DeleteRequest = FastifyRequest<{
  Params: { id: string };
}>;

export async function deleteUser(
  request: DeleteRequest,
  reply: FastifyReply
): Promise<void | ApiResponse<never>> {
  const paramsResult = idParamSchema.safeParse(request.params);

  if (!paramsResult.success) {
    return reply.status(400).send({
      success: false,
      error: paramsResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: paramsResult.data.id },
  });

  if (!existingUser) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  await prisma.user.delete({
    where: { id: paramsResult.data.id },
  });

  return reply.status(204).send();
}
