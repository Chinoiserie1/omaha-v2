import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse } from "@repo/shared";
import { getLatestSession, getSessionMessages } from "../../../store/chat.repository.js";

interface ChatHistoryQuery {
  limit?: string;
  cursor?: string;
  sessionId?: string;
}

interface ChatMessageResponse {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ChatHistoryResponse {
  sessionId: string;
  messages: ChatMessageResponse[];
}

export async function getChatHistoryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<ChatHistoryResponse> | ApiResponse<never>> {
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

  // Resolve session: use provided sessionId or fall back to latest
  let sessionId = query.sessionId;

  if (!sessionId) {
    const session = await getLatestSession(user.id);
    sessionId = session.id;
  }

  const messages = await getSessionMessages(sessionId, limit, cursor);

  return {
    success: true,
    data: {
      sessionId,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  };
}
