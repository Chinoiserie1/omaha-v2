import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { confirmRedeemSchema, type ApiResponse } from "@repo/shared";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import { enqueueFulfillJob } from "../../../queue/withdrawal-queue.js";
import { notifyUser } from "../../../infra/websocket.js";
import { getConnection } from "../../../solana/config.js";
import { logger } from "../../../utils/logger.js";

type ConfirmRedeemRequest = FastifyRequest<{
  Params: { withdrawalId: string };
  Body: { txSignature: string };
}>;

/**
 * Confirm that the user signed and submitted the queuedRedeem tx.
 * Verifies on-chain, transitions REQUESTED → PROCESSING, enqueues fulfill job.
 * On failure: transitions to REMOVED so the user can retry immediately.
 */
export async function confirmRedeemHandler(
  request: ConfirmRedeemRequest,
  reply: FastifyReply,
) {
  const { withdrawalId } = request.params;
  const bodyResult = confirmRedeemSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      success: false,
      error: bodyResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const { txSignature } = bodyResult.data;

  try {
    logger.info(
      { withdrawalId, txSignature },
      "Confirming redeem transaction on-chain",
    );

    const withdrawal = await withdrawalRepo.findById(withdrawalId);
    if (!withdrawal) {
      return reply.status(404).send({
        success: false,
        error: "Withdrawal request not found",
      } satisfies ApiResponse<never>);
    }

    // Verify ownership
    const user = await prisma.user.findUnique({
      where: { privyId: request.privyUserId },
    });
    if (!user || withdrawal.userId !== user.id) {
      return reply.status(403).send({
        success: false,
        error: "Forbidden",
      } satisfies ApiResponse<never>);
    }

    if (withdrawal.status !== "REQUESTED") {
      return reply.status(400).send({
        success: false,
        error: `Cannot confirm redeem for status "${withdrawal.status}"`,
      } satisfies ApiResponse<never>);
    }

    // Wait for tx to land on-chain using non-deprecated API
    const connection = getConnection();

    logger.info({ withdrawalId, txSignature }, "Waiting for tx confirmation");
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const confirmation = await connection.confirmTransaction(
      { signature: txSignature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    if (confirmation.value.err) {
      const errorDetail = JSON.stringify(confirmation.value.err);
      const reason = `Redeem transaction failed on-chain: ${errorDetail}`;
      logger.error(
        { withdrawalId, txSignature, onChainError: confirmation.value.err },
        reason,
      );

      await withdrawalRepo.markAsRemoved(withdrawalId, reason, {
        redeemTxSignature: txSignature,
      });

      return reply.status(400).send({
        success: false,
        error: reason,
      } satisfies ApiResponse<never>);
    }

    // Transition REQUESTED → PROCESSING
    const now = new Date();
    await withdrawalRepo.updateStatus(withdrawalId, "PROCESSING", {
      redeemTxSignature: txSignature,
      processingAt: now,
    });

    // Notify user
    notifyUser(withdrawal.userId, "withdrawal:status", {
      withdrawalId,
      status: "PROCESSING",
      timestamp: now.toISOString(),
      redeemTxSignature: txSignature,
    });

    // Enqueue fulfill job for this vault
    await enqueueFulfillJob(withdrawal.kolVaultId);

    // Reload to log the full state
    const updated = await withdrawalRepo.findById(withdrawalId);
    logger.info(
      {
        withdrawalId,
        txSignature,
        withdrawal: updated
          ? {
              id: updated.id,
              userId: updated.userId,
              kolVaultId: updated.kolVaultId,
              amount: updated.amount,
              status: updated.status,
              batchId: updated.batchId,
              idempotencyKey: updated.idempotencyKey,
              redeemTxSignature: updated.redeemTxSignature,
              processingAt: updated.processingAt,
              requestedAt: updated.requestedAt,
            }
          : null,
      },
      "[DEBUG] Redeem confirmed, fulfill job enqueued — full withdrawal state",
    );

    return { success: true, data: { withdrawalId, status: "PROCESSING" } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      { withdrawalId, txSignature, err },
      `Failed to confirm redeem: ${msg}`,
    );

    // Soft-delete so the user can retry immediately
    try {
      await withdrawalRepo.markAsRemoved(
        withdrawalId,
        `Confirm-redeem failed: ${msg}`,
        { redeemTxSignature: txSignature },
      );
    } catch (updateErr) {
      logger.error(
        { withdrawalId, updateErr },
        "Failed to mark withdrawal as REMOVED after error",
      );
    }

    return reply.status(400).send({
      success: false,
      error: msg,
    } satisfies ApiResponse<never>);
  }
}
