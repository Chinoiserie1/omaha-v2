import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { createUserSchema, type ApiResponse, type User } from "@repo/shared";

type CreateRequest = FastifyRequest<{
  Body: { privyId: string; email?: string; name?: string };
}>;

export async function createUser(
  request: CreateRequest,
  reply: FastifyReply
): Promise<ApiResponse<User> | ApiResponse<never>> {
  const bodyResult = createUserSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      success: false,
      error: bodyResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const existingUser = await prisma.user.findUnique({
    where: { privyId: bodyResult.data.privyId },
  });

  if (existingUser) {
    return reply.status(409).send({
      success: false,
      error: "User with this Privy ID already exists",
    } satisfies ApiResponse<never>);
  }

  const user = await prisma.user.create({
    data: {
      privyId: bodyResult.data.privyId,
      email: bodyResult.data.email ?? null,
      name: bodyResult.data.name ?? null,
    },
  });

  return reply
    .status(201)
    .send({ success: true, data: user } satisfies ApiResponse<User>);
}
