import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiResponse } from "@repo/shared";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";

type StatusRequest = FastifyRequest<{
  Params: { withdrawalId: string };
}>;

export async function getWithdrawalStatus(
  request: StatusRequest,
  reply: FastifyReply,
) {
  const { withdrawalId } = request.params;

  const withdrawal = await withdrawalRepo.findById(withdrawalId);
  if (!withdrawal) {
    return reply.status(404).send({
      success: false,
      error: "Withdrawal not found",
    } satisfies ApiResponse<never>);
  }

  return { success: true, data: withdrawal };
}
