import { prisma } from "@repo/database";

export async function findFavorite(userId: string, vaultId: string) {
  return prisma.vaultFavorite.findUnique({
    where: { userId_vaultId: { userId, vaultId } },
  });
}

export async function createFavorite(userId: string, vaultId: string) {
  return prisma.vaultFavorite.create({
    data: { userId, vaultId },
  });
}

export async function deleteFavorite(userId: string, vaultId: string) {
  await prisma.vaultFavorite.delete({
    where: { userId_vaultId: { userId, vaultId } },
  });
}
