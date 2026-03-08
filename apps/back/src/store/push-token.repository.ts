import { prisma } from "@repo/database";

export async function upsertToken(
  userId: string,
  token: string,
  platform?: string,
) {
  return prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, ...(platform ? { platform } : {}) },
    update: { userId, ...(platform ? { platform } : {}) },
  });
}

export async function deleteToken(token: string) {
  return prisma.pushToken.deleteMany({ where: { token } });
}

export async function findTokensByUserIds(userIds: string[]) {
  return prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
  });
}
