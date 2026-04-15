import { prisma } from "@repo/database";
import type { HoldingsSnapshot, SnapshotHolding } from "@repo/database";
import type { HoldingCreateInput } from "../utils/snapshot-converters.js";

export type HoldingsSnapshotWithHoldings = HoldingsSnapshot & {
  holdingRows: SnapshotHolding[];
};

const includeHoldings = { holdingRows: true } as const;

export async function createSnapshot(data: {
  vaultId: string;
  holdings: readonly HoldingCreateInput[];
  totalEquityUsd: number;
}): Promise<HoldingsSnapshotWithHoldings> {
  // Close previous snapshot by setting its endDate
  await prisma.holdingsSnapshot.updateMany({
    where: { vaultId: data.vaultId, endDate: null },
    data: { endDate: new Date() },
  });

  return prisma.holdingsSnapshot.create({
    data: {
      vaultId: data.vaultId,
      totalEquityUsd: data.totalEquityUsd,
      holdingRows: {
        create: data.holdings.map((h) => ({
          mint: h.mint,
          symbol: h.symbol,
          tokenId: h.tokenId ?? null,
          uiAmount: h.uiAmount,
          price: h.price,
          valueUsd: h.valueUsd,
          percentage: h.percentage,
        })),
      },
    },
    include: includeHoldings,
  });
}

export async function findCurrentByVault(
  vaultId: string,
): Promise<HoldingsSnapshotWithHoldings | null> {
  return prisma.holdingsSnapshot.findFirst({
    where: { vaultId, endDate: null },
    orderBy: { startDate: "desc" },
    include: includeHoldings,
  });
}
