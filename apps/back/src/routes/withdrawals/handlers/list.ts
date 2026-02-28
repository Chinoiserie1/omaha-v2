import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse } from "@repo/shared";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import { enrichWithdrawal } from "./enrich.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type ListRequest = FastifyRequest<{
  Querystring: { limit?: string; cursor?: string };
}>;

export async function listWithdrawals(
  request: ListRequest,
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

  const rawLimit = parseInt(request.query.limit ?? "", 10);
  const limit = Math.min(
    Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const cursor = request.query.cursor;

  const withdrawals = await withdrawalRepo.findByUser(user.id, {
    limit: limit + 1, // fetch one extra to detect next page
    cursor,
  });

  const hasMore = withdrawals.length > limit;
  const items = hasMore ? withdrawals.slice(0, limit) : withdrawals;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  return {
    success: true,
    data: items.map(enrichWithdrawal),
    nextCursor,
  };
}
