import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse } from "@repo/shared";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import { enrichWithdrawal } from "./enrich.js";

type StatusRequest = FastifyRequest<{
  Params: { withdrawalId: string };
}>;

export async function getWithdrawalStatus(
  request: StatusRequest,
  reply: FastifyReply,
) {
  const { withdrawalId } = request.params;

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
  if (!withdrawal) {
    return reply.status(404).send({
      success: false,
      error: "Withdrawal not found",
    } satisfies ApiResponse<never>);
  }

  if (withdrawal.userId !== user.id) {
    return reply.status(403).send({
      success: false,
      error: "Forbidden",
    } satisfies ApiResponse<never>);
  }

  return { success: true, data: enrichWithdrawal(withdrawal) };
}
