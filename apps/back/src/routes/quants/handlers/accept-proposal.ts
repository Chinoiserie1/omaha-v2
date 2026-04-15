import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { z } from "zod";
import type { Allocation, ApiResponse } from "@repo/shared";
import { AllocationSchema } from "@repo/shared";
import { logger } from "../../../utils/logger.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import { rebalanceVault } from "../../../services/rebalancer.service.js";
import { allocationsToCreateInputs } from "../../../utils/snapshot-converters.js";

const AcceptProposalSchema = z.object({
  thesisSummary: z.string().min(1),
  allocations: z.array(AllocationSchema),
  changes: z.array(z.string()),
});

type AcceptProposalRequest = FastifyRequest<{
  Params: { quantId: string };
}>;

interface AcceptProposalResponse {
  snapshotId: string;
  rebalanceTriggered: boolean;
}

export async function acceptProposal(
  request: AcceptProposalRequest,
  reply: FastifyReply,
): Promise<ApiResponse<AcceptProposalResponse> | ApiResponse<never>> {
  const { quantId } = request.params;

  // Verify user owns this quant
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
    include: { quant: { select: { id: true } } },
  });

  if (!user?.quant || user.quant.id !== quantId) {
    return reply.status(403).send({
      success: false,
      error: "Not authorized to modify this Quant",
    } satisfies ApiResponse<never>);
  }

  const parsed = AcceptProposalSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const { thesisSummary, allocations, changes } = parsed.data;

  const snapshot = await portfolioRepo.createSnapshot({
    quantId,
    thesisSummary,
    allocations: allocationsToCreateInputs(allocations as Allocation[]),
    changes,
    sourceTweetIds: [],
  });

  let rebalanceTriggered = false;

  const vault = await vaultRepo.findByQuantId(quantId);
  if (vault?.isActive) {
    rebalanceTriggered = true;
    rebalanceVault(quantId).catch((err) => {
      logger.error({ quantId, err }, "Rebalance after proposal accept failed");
    });
  }

  return {
    success: true,
    data: {
      snapshotId: snapshot.id,
      rebalanceTriggered,
    },
  };
}
