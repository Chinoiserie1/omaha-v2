import { prisma } from "@repo/database";

export async function createChatMessage(userId: string, role: string, content: string) {
  return prisma.chatMessage.create({
    data: { userId, role, content },
  });
}

export async function getChatHistory(userId: string, limit: number = 50, cursor?: string) {
  return prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}
