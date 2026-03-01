import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { claimWithdrawalSchema, type ApiResponse } from "@repo/shared";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import { buildClaimTransaction } from "../../../services/withdrawal-claim.service.js";
import { logger } from "../../../utils/logger.js";

type ClaimRequest = FastifyRequest<{
  Params: { withdrawalId: string };
  Body: { signerPublicKey: string };
}>;

export async function claimWithdrawal(
  request: ClaimRequest,
  reply: FastifyReply,
) {
  const { withdrawalId } = request.params;
  const bodyResult = claimWithdrawalSchema.safeParse(request.body);

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
      { withdrawalId, signer: bodyResult.data.signerPublicKey },
      "Building claim transaction",
    );

    const result = await buildClaimTransaction(
      withdrawalId,
      bodyResult.data.signerPublicKey,
    );

    logger.info({ withdrawalId }, "Claim transaction built successfully");
    return { success: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      { withdrawalId, signer: bodyResult.data.signerPublicKey, err },
      "Failed to build claim transaction",
    );
    return reply.status(400).send({
      success: false,
      error: msg,
    } satisfies ApiResponse<never>);
  }
}
