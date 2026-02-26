import { prisma } from "@repo/database";
import type { HoldingsSnapshot, Prisma } from "@repo/database";

export async function createSnapshot(data: {
  kolVaultId: string;
  holdings: Prisma.InputJsonValue;
  totalEquityUsd: number;
}): Promise<HoldingsSnapshot> {
  // Close previous snapshot by setting its endDate
  await prisma.holdingsSnapshot.updateMany({
    where: { kolVaultId: data.kolVaultId, endDate: null },
    data: { endDate: new Date() },
  });

  return prisma.holdingsSnapshot.create({ data });
}

export async function findCurrentByKolVault(
  kolVaultId: string,
): Promise<HoldingsSnapshot | null> {
  return prisma.holdingsSnapshot.findFirst({
    where: { kolVaultId, endDate: null },
    orderBy: { startDate: "desc" },
  });
}
