import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { createWithdrawalSchema, type ApiResponse } from "@repo/shared";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import { computeBatchId, computeIdempotencyKey, remainingBatchWindowMs } from "../../../queue/batch-utils.js";
import { enqueueWithdrawalBatch } from "../../../queue/withdrawal-queue.js";
import { logger } from "../../../utils/logger.js";

type RequestBody = FastifyRequest<{
  Params: { vaultId: string };
  Body: { amount: number; signerPublicKey: string };
}>;

export async function requestWithdrawal(
  request: RequestBody,
  reply: FastifyReply,
) {
  const { vaultId } = request.params;
  const bodyResult = createWithdrawalSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      success: false,
      error: bodyResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const { amount } = bodyResult.data;

  // Resolve user
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });
  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  // Compute batch + idempotency
  const now = Date.now();
  const batchId = computeBatchId(vaultId, now);
  const idempotencyKey = computeIdempotencyKey(user.id, vaultId, batchId);

  // Check for existing request in this batch window
  const existing = await withdrawalRepo.findByIdempotencyKey(idempotencyKey);

  if (existing) {
    // Merge: add to existing request amount
    const updated = await withdrawalRepo.addAmountToExisting(
      existing.id,
      amount,
    );
    logger.info(
      { withdrawalId: updated.id, newAmount: updated.amount },
      "Merged withdrawal request into existing",
    );
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  // Create new request
  const withdrawal = await withdrawalRepo.createRequest({
    userId: user.id,
    kolVaultId: vaultId,
    amount,
    idempotencyKey,
    batchId,
  });

  // Enqueue batch processing with delay = remaining window time
  const delayMs = remainingBatchWindowMs(now);
  await enqueueWithdrawalBatch(batchId, vaultId, delayMs);

  logger.info(
    { withdrawalId: withdrawal.id, batchId, delayMs },
    "Withdrawal request created",
  );

  return reply.status(201).send({
    success: true,
    data: withdrawal,
  });
}
