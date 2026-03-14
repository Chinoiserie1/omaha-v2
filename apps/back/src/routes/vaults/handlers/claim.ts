import type { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../../../utils/logger.js";

type ClaimRequest = FastifyRequest<{
  Params: { id: string };
  Body: { signerPublicKey: string };
}>;

/** @deprecated Custom vault has no separate claim step — FulfillWithdraw handles it */
export async function claimRedemption(
  request: ClaimRequest,
  reply: FastifyReply,
) {
  logger.warn("DEPRECATED: POST /api/vaults/:id/claim — custom vault has no separate claim step");

  return reply.status(410).send({
    error: "Claim is no longer needed. Withdrawals are fulfilled directly by the admin.",
  });
}
