import { prisma } from "@repo/database";
import type { SnapshotPerformance, Prisma } from "@repo/database";

export async function findBySnapshotPair(
  fromSnapshotId: string,
  toSnapshotId: string
): Promise<SnapshotPerformance | null> {
  return prisma.snapshotPerformance.findUnique({
    where: {
      fromSnapshotId_toSnapshotId: { fromSnapshotId, toSnapshotId },
    },
  });
}

export async function findByKol(
  kolId: string
): Promise<SnapshotPerformance[]> {
  return prisma.snapshotPerformance.findMany({
    where: { kolId },
    orderBy: { computedAt: "asc" },
  });
}

export async function findLatestByKol(
  kolId: string
): Promise<SnapshotPerformance | null> {
  return prisma.snapshotPerformance.findFirst({
    where: { kolId },
    orderBy: { computedAt: "desc" },
  });
}

export async function upsert(data: {
  kolId: string;
  fromSnapshotId: string;
  toSnapshotId: string;
  periodReturn: number;
  cumulativeValue: number;
  periodDays: number;
  details?: Prisma.InputJsonValue;
}): Promise<SnapshotPerformance> {
  return prisma.snapshotPerformance.upsert({
    where: {
      fromSnapshotId_toSnapshotId: {
        fromSnapshotId: data.fromSnapshotId,
        toSnapshotId: data.toSnapshotId,
      },
    },
    update: {
      periodReturn: data.periodReturn,
      cumulativeValue: data.cumulativeValue,
      periodDays: data.periodDays,
      ...(data.details !== undefined && { details: data.details }),
    },
    create: data,
  });
}
