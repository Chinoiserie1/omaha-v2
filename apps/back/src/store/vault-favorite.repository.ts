import { prisma } from "@repo/database";

export async function findFavorite(userId: string, kolVaultId: string) {
  return prisma.vaultFavorite.findUnique({
    where: { userId_kolVaultId: { userId, kolVaultId } },
  });
}

export async function createFavorite(userId: string, kolVaultId: string) {
  return prisma.vaultFavorite.create({
    data: { userId, kolVaultId },
  });
}

export async function deleteFavorite(userId: string, kolVaultId: string) {
  await prisma.vaultFavorite.delete({
    where: { userId_kolVaultId: { userId, kolVaultId } },
  });
}
