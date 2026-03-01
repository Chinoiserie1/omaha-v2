import type { FastifyReply, FastifyRequest } from "fastify";
import type { PortfolioSnapshot } from "@repo/database";
import { paginationSchema } from "@repo/shared";
import type { PaginatedResponse } from "@repo/shared";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";

function formatVaultSummary(
  vault: {
    id: string;
    name: string;
    description: string;
    kolUsername: string;
    kolId: string;
    statePda: string;
    glamVaultPda: string | null;
    mintAddress: string | null;
    isActive: boolean;
  },
  portfolio: PortfolioSnapshot | null
) {
  return {
    id: vault.id,
    name: vault.name,
    description: vault.description,
    kolUsername: vault.kolUsername,
    kolId: vault.kolId,
    glamStatePda: vault.statePda,
    glamVaultPda: vault.glamVaultPda,
    mintAddress: vault.mintAddress,
    isActive: vault.isActive,
    portfolio: portfolio
      ? {
          thesisSummary: portfolio.thesisSummary,
          allocations: portfolio.allocations as Record<string, unknown>,
          updatedAt: portfolio.createdAt,
        }
      : null,
  };
}

export async function listVaults(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parsed = paginationSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    });
  }

  const { page, pageSize } = parsed.data;
  const skip = (page - 1) * pageSize;

  const { vaults, total } = await vaultRepo.findActiveVaultsPaginated({
    skip,
    take: pageSize,
  });

  const items = await Promise.all(
    vaults.map(async (vault) => {
      const portfolio = await portfolioRepo.findLatestSnapshot(vault.kolId);
      return formatVaultSummary(vault, portfolio);
    })
  );

  const response: PaginatedResponse<ReturnType<typeof formatVaultSummary>> = {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };

  return response;
}
