import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { confirmRedeemSchema, type ApiResponse } from "@repo/shared";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import { enqueueFulfillJob } from "../../../queue/withdrawal-queue.js";
import { notifyUser } from "../../../infra/websocket.js";
import { getConnection } from "../../../solana/config.js";
import { detectInstantMode } from "./detect-withdraw-mode.js";
import { logger } from "../../../utils/logger.js";

type ConfirmRedeemRequest = FastifyRequest<{
  Params: { withdrawalId: string };
  Body: { txSignature: string };
}>;

/**
 * Confirm that the user signed and submitted the redeem tx.
 * Verifies on-chain, then determines the mode:
 *   - Instant (WithdrawWithPrice): no PendingWithdraw PDA → REQUESTED → CLAIMED
 *   - Queued  (RequestWithdraw):   PendingWithdraw PDA exists → REQUESTED → PROCESSING → batch
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

    // Wait for tx to land on-chain
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

    // Detect mode by checking if PendingWithdraw PDA exists
    const isInstant = await detectInstantMode(withdrawal.vaultId, user.walletAddress);
    const now = new Date();

    if (isInstant) {
      await withdrawalRepo.updateStatus(withdrawalId, "CLAIMED", {
        redeemTxSignature: txSignature,
        claimedAt: now,
      });

      notifyUser(user.id, "withdrawal:status", {
        withdrawalId,
        status: "CLAIMED",
        timestamp: now.toISOString(),
        redeemTxSignature: txSignature,
      });

      logger.info(
        { withdrawalId, txSignature, mode: "instant" },
        "Instant withdrawal confirmed — CLAIMED directly",
      );

      return { success: true, data: { withdrawalId, status: "CLAIMED", mode: "instant" } };
    }

    // Queued path: PROCESSING + enqueue batch
    await withdrawalRepo.updateStatus(withdrawalId, "PROCESSING", {
      redeemTxSignature: txSignature,
      processingAt: now,
    });

    notifyUser(user.id, "withdrawal:status", {
      withdrawalId,
      status: "PROCESSING",
      timestamp: now.toISOString(),
      redeemTxSignature: txSignature,
    });

    await enqueueFulfillJob(withdrawal.vaultId);

    logger.info(
      { withdrawalId, txSignature, mode: "queued" },
      "Queued withdrawal confirmed — PROCESSING, fulfill job enqueued",
    );

    return { success: true, data: { withdrawalId, status: "PROCESSING", mode: "queued" } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      { withdrawalId, txSignature, err },
      `Failed to confirm redeem: ${msg}`,
    );

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
