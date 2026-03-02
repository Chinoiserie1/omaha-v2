import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { confirmClaimSchema, type ApiResponse } from "@repo/shared";
import { confirmClaim } from "../../../services/withdrawal-claim.service.js";
import { captureSnapshotIfChanged } from "../../../services/portfolio-snapshot.service.js";
import { notifyUser } from "../../../infra/websocket.js";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import { logger } from "../../../utils/logger.js";

type ConfirmClaimRequest = FastifyRequest<{
  Params: { withdrawalId: string };
  Body: { txSignature: string };
}>;

export async function confirmClaimHandler(
  request: ConfirmClaimRequest,
  reply: FastifyReply,
) {
  const { withdrawalId } = request.params;
  const bodyResult = confirmClaimSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      success: false,
      error: bodyResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  // Verify ownership
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });
  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  const withdrawal = await withdrawalRepo.findById(withdrawalId);
  if (!withdrawal || withdrawal.userId !== user.id) {
    return reply.status(403).send({
      success: false,
      error: "Forbidden",
    } satisfies ApiResponse<never>);
  }

  try {
    logger.info(
      { withdrawalId, txSignature: bodyResult.data.txSignature },
      "Confirming claim on-chain",
    );

    await confirmClaim(withdrawalId, bodyResult.data.txSignature);

    const updated = await withdrawalRepo.findById(withdrawalId);

    if (updated) {
      notifyUser(updated.userId, "withdrawal:status", {
        withdrawalId,
        status: "CLAIMED",
        timestamp: new Date().toISOString(),
        claimTxSignature: bodyResult.data.txSignature,
      });
    }

    // Capture portfolio snapshot after withdrawal (async, non-blocking)
    if (user.walletAddress) {
      setImmediate(() => {
        captureSnapshotIfChanged(user.walletAddress!).catch((err) => {
          logger.warn(
            { err, address: user.walletAddress },
            "Post-withdrawal portfolio snapshot failed",
          );
        });
      });
    }

    logger.info({ withdrawalId }, "Claim confirmed successfully");
    return { success: true, data: { withdrawalId, status: "CLAIMED" } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      { withdrawalId, txSignature: bodyResult.data.txSignature, err },
      "Failed to confirm claim",
    );
    return reply.status(400).send({
      success: false,
      error: msg,
    } satisfies ApiResponse<never>);
  }
}
