import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse } from "@repo/shared";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";

export async function listWithdrawals(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });

  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  const withdrawals = await withdrawalRepo.findByUser(user.id);

  return { success: true, data: withdrawals };
}
