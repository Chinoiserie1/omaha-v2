import type { FastifyReply, FastifyRequest } from "fastify";
import { claimWithdrawalSchema, type ApiResponse } from "@repo/shared";
import { buildClaimTransaction } from "../../../services/withdrawal-claim.service.js";

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

  try {
    const result = await buildClaimTransaction(
      withdrawalId,
      bodyResult.data.signerPublicKey,
    );

    return { success: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return reply.status(400).send({
      success: false,
      error: msg,
    } satisfies ApiResponse<never>);
  }
}
