import { prisma } from "@repo/database";
import type { WithdrawalRequest } from "@repo/database";

export async function createRequest(data: {
  userId: string;
  vaultId: string;
  amount: number;
  idempotencyKey: string;
  batchId: string;
}): Promise<WithdrawalRequest> {
  return prisma.withdrawalRequest.create({ data });
}

export async function findByIdempotencyKey(
  key: string,
): Promise<WithdrawalRequest | null> {
  return prisma.withdrawalRequest.findFirst({
    where: { idempotencyKey: key, status: { not: "REMOVED" } },
  });
}

export async function findById(
  id: string,
): Promise<WithdrawalRequest | null> {
  return prisma.withdrawalRequest.findUnique({ where: { id } });
}

export async function findByBatchId(
  batchId: string,
): Promise<WithdrawalRequest[]> {
  return prisma.withdrawalRequest.findMany({
    where: { batchId },
    orderBy: { requestedAt: "asc" },
  });
}

export async function findByUser(
  userId: string,
  options?: { limit?: number; cursor?: string },
): Promise<WithdrawalRequest[]> {
  return prisma.withdrawalRequest.findMany({
    where: { userId, status: { not: "REMOVED" } },
    orderBy: { requestedAt: "desc" },
    ...(options?.limit && { take: options.limit }),
    ...(options?.cursor && {
      skip: 1,
      cursor: { id: options.cursor },
    }),
  });
}

export async function findByUserAndVault(
  userId: string,
  vaultId: string,
): Promise<WithdrawalRequest[]> {
  return prisma.withdrawalRequest.findMany({
    where: { userId, vaultId, status: { not: "REMOVED" } },
    orderBy: { requestedAt: "desc" },
  });
}

export async function findActiveByUserAndVault(
  userId: string,
  vaultId: string,
): Promise<WithdrawalRequest | null> {
  return prisma.withdrawalRequest.findFirst({
    where: {
      userId,
      vaultId,
      status: { in: ["REQUESTED", "PROCESSING", "CLAIMABLE"] },
    },
    orderBy: { requestedAt: "desc" },
  });
}

export async function updateStatus(
  id: string,
  status: string,
  extra?: Partial<
    Pick<
      WithdrawalRequest,
      | "redeemTxSignature"
      | "claimTxSignature"
      | "errorMessage"
      | "errorCount"
      | "removedReason"
      | "processingAt"
      | "claimableAt"
      | "claimedAt"
      | "failedAt"
    >
  >,
): Promise<WithdrawalRequest> {
  return prisma.withdrawalRequest.update({
    where: { id },
    data: { status, ...extra },
  });
}

export async function updateManyStatus(
  ids: string[],
  status: string,
  extra?: Record<string, unknown>,
): Promise<number> {
  const result = await prisma.withdrawalRequest.updateMany({
    where: { id: { in: ids } },
    data: { status, ...extra },
  });
  return result.count;
}

export async function incrementErrorCount(id: string): Promise<void> {
  await prisma.withdrawalRequest.update({
    where: { id },
    data: { errorCount: { increment: 1 } },
  });
}

export async function updateBatchStatus(
  batchId: string,
  fromStatus: string,
  toStatus: string,
  extra?: Record<string, unknown>,
): Promise<number> {
  const result = await prisma.withdrawalRequest.updateMany({
    where: { batchId, status: fromStatus },
    data: { status: toStatus, ...extra },
  });
  return result.count;
}

/**
 * Mark a withdrawal as REMOVED and free the idempotency slot
 * so the user can retry with the same batch window.
 */
export async function markAsRemoved(
  id: string,
  reason: string,
  extra?: Partial<Pick<WithdrawalRequest, "redeemTxSignature">>,
): Promise<WithdrawalRequest> {
  return prisma.withdrawalRequest.update({
    where: { id },
    data: {
      status: "REMOVED",
      removedReason: reason,
      idempotencyKey: `removed_${id}_${Date.now()}`,
      ...extra,
    },
  });
}

export async function addAmountToExisting(
  id: string,
  additionalAmount: number,
): Promise<WithdrawalRequest> {
  return prisma.withdrawalRequest.update({
    where: { id },
    data: { amount: { increment: additionalAmount } },
  });
}

export async function reassignBatch(
  id: string,
  newBatchId: string,
): Promise<WithdrawalRequest> {
  return prisma.withdrawalRequest.update({
    where: { id },
    data: { batchId: newBatchId },
  });
}

export async function findPendingFulfill(
  vaultId: string,
): Promise<WithdrawalRequest[]> {
  return prisma.withdrawalRequest.findMany({
    where: { vaultId, status: "PROCESSING" },
    orderBy: { requestedAt: "asc" },
  });
}

export async function findStuckRequested(
  olderThanMs: number,
): Promise<WithdrawalRequest[]> {
  const cutoff = new Date(Date.now() - olderThanMs);
  return prisma.withdrawalRequest.findMany({
    where: { status: "REQUESTED", requestedAt: { lt: cutoff } },
  });
}

export async function findStuckProcessing(
  olderThanMs: number,
): Promise<WithdrawalRequest[]> {
  const cutoff = new Date(Date.now() - olderThanMs);
  return prisma.withdrawalRequest.findMany({
    where: { status: "PROCESSING", processingAt: { lt: cutoff } },
  });
}
