import { prisma } from "@repo/database";
import type { HoldingsSnapshot, Prisma } from "@repo/database";

export async function createSnapshot(data: {
  vaultId: string;
  holdings: Prisma.InputJsonValue;
  totalEquityUsd: number;
}): Promise<HoldingsSnapshot> {
  // Close previous snapshot by setting its endDate
  await prisma.holdingsSnapshot.updateMany({
    where: { vaultId: data.vaultId, endDate: null },
    data: { endDate: new Date() },
  });

  return prisma.holdingsSnapshot.create({ data });
}

export async function findCurrentByVault(
  vaultId: string,
): Promise<HoldingsSnapshot | null> {
  return prisma.holdingsSnapshot.findFirst({
    where: { vaultId, endDate: null },
    orderBy: { startDate: "desc" },
  });
}
