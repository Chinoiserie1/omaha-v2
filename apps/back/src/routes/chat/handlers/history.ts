import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse } from "@repo/shared";

interface ChatHistoryQuery {
  limit?: string;
  cursor?: string;
}

interface ChatMessageResponse {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export async function getChatHistoryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<ChatMessageResponse[]> | ApiResponse<never>> {
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });

  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  const query = request.query as ChatHistoryQuery;
  const limit = Math.min(Number(query.limit) || 50, 100);
  const cursor = query.cursor;

  const messages = await prisma.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  return {
    success: true,
    data: messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
