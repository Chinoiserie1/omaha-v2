import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse } from "@repo/shared";
import { createSession } from "../../../store/chat.repository.js";

interface SessionResponse {
  id: string;
  createdAt: string;
}

export async function createSessionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<SessionResponse> | ApiResponse<never>> {
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });

  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  const session = await createSession(user.id);

  return {
    success: true,
    data: {
      id: session.id,
      createdAt: session.createdAt.toISOString(),
    },
  };
}
