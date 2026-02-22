import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import {
  idParamSchema,
  updateUserSchema,
  type ApiResponse,
  type User,
} from "@repo/shared";

type UpdateRequest = FastifyRequest<{
  Params: { id: string };
  Body: { email?: string; name?: string; username?: string };
}>;

export async function updateUser(
  request: UpdateRequest,
  reply: FastifyReply
): Promise<ApiResponse<User> | ApiResponse<never>> {
  const paramsResult = idParamSchema.safeParse(request.params);

  if (!paramsResult.success) {
    return reply.status(400).send({
      success: false,
      error: paramsResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const bodyResult = updateUserSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      success: false,
      error: bodyResult.error.errors.map((e) => e.message).join(", "),
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

  // Check username uniqueness if being updated
  if (bodyResult.data.username !== undefined) {
    const usernameOwner = await prisma.user.findUnique({
      where: { username: bodyResult.data.username },
    });

    if (usernameOwner && usernameOwner.id !== paramsResult.data.id) {
      return reply.status(409).send({
        success: false,
        error: "Username is already taken",
      } satisfies ApiResponse<never>);
    }
  }

  const updateData: { email?: string; name?: string | null; username?: string } = {};
  if (bodyResult.data.email !== undefined) {
    updateData.email = bodyResult.data.email;
  }
  if (bodyResult.data.name !== undefined) {
    updateData.name = bodyResult.data.name;
  }
  if (bodyResult.data.username !== undefined) {
    updateData.username = bodyResult.data.username;
  }

  const user = await prisma.user.update({
    where: { id: paramsResult.data.id },
    data: updateData,
  });

  return { success: true, data: user } satisfies ApiResponse<User>;
}
