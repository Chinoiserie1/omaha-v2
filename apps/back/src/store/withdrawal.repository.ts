import { prisma } from "@repo/database";
import type { WithdrawalRequest } from "@repo/database";

export async function createRequest(data: {
  userId: string;
  kolVaultId: string;
  amount: number;
  idempotencyKey: string;
  batchId: string;
}): Promise<WithdrawalRequest> {
  return prisma.withdrawalRequest.create({ data });
}

export async function findByIdempotencyKey(
  key: string,
): Promise<WithdrawalRequest | null> {
  return prisma.withdrawalRequest.findUnique({
    where: { idempotencyKey: key },
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
): Promise<WithdrawalRequest[]> {
  return prisma.withdrawalRequest.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
  });
}

export async function findByUserAndVault(
  userId: string,
  kolVaultId: string,
): Promise<WithdrawalRequest[]> {
  return prisma.withdrawalRequest.findMany({
    where: { userId, kolVaultId },
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

export async function addAmountToExisting(
  id: string,
  additionalAmount: number,
): Promise<WithdrawalRequest> {
  return prisma.withdrawalRequest.update({
    where: { id },
    data: { amount: { increment: additionalAmount } },
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
