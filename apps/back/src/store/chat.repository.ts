import { prisma } from "@repo/database";

export async function createSession(userId: string) {
  return prisma.chatSession.create({
    data: { userId },
  });
}

export async function getLatestSession(userId: string) {
  const session = await prisma.chatSession.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (session) return session;

  return prisma.chatSession.create({
    data: { userId },
  });
}

export async function createChatMessage(
  sessionId: string,
  userId: string,
  role: string,
  content: string,
) {
  return prisma.chatMessage.create({
    data: { sessionId, userId, role, content },
  });
}

export async function getSessionMessages(
  sessionId: string,
  limit: number = 50,
  cursor?: string,
) {
  return prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}
