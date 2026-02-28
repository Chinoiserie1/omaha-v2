import type { FastifyReply, FastifyRequest } from "fastify";
import { confirmClaimSchema, type ApiResponse } from "@repo/shared";
import { confirmClaim } from "../../../services/withdrawal-claim.service.js";
import { notifyUser } from "../../../infra/websocket.js";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";

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

  try {
    await confirmClaim(withdrawalId, bodyResult.data.txSignature);

    const withdrawal = await withdrawalRepo.findById(withdrawalId);

    if (withdrawal) {
      notifyUser(withdrawal.userId, "withdrawal:status", {
        withdrawalId,
        status: "CLAIMED",
        timestamp: new Date().toISOString(),
        claimTxSignature: bodyResult.data.txSignature,
      });
    }

    return { success: true, data: { withdrawalId, status: "CLAIMED" } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return reply.status(400).send({
      success: false,
      error: msg,
    } satisfies ApiResponse<never>);
  }
}
