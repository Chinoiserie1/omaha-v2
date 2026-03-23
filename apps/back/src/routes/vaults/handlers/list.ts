import type { FastifyReply, FastifyRequest } from "fastify";
import type { PortfolioSnapshot } from "@repo/database";
import { vaultListQuerySchema } from "@repo/shared";
import type { PaginatedResponse } from "@repo/shared";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";
import * as tokenPriceRepo from "../../../store/token-price.repository.js";

function formatVaultSummary(
  vault: {
    id: string;
    vaultName: string;
    quantId: string;
    statePda: string;
    shareMint: string | null;
    mintAddress: string | null;
    isActive: boolean;
    about: string;
    quant?: { user?: { twitterUsername: string | null; profileImageUrl: string | null } | null } | null;
  },
  portfolio: PortfolioSnapshot | null,
  performancePercent: number | null
) {
  return {
    id: vault.id,
    name: vault.vaultName,
    description: vault.about,
    quantUsername: vault.quant?.user?.twitterUsername,
    quantId: vault.quantId,
    statePda: vault.statePda,
    shareMint: vault.shareMint,
    mintAddress: vault.mintAddress,
    isActive: vault.isActive,
    quantAvatarUrl: vault.quant?.user?.profileImageUrl,
    performancePercent,
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
  const parsed = vaultListQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    });
  }

  const { page, pageSize, search } = parsed.data;
  const skip = (page - 1) * pageSize;

  const { vaults, total } = await vaultRepo.findActiveVaultsPaginated({
    skip,
    take: pageSize,
    ...(search ? { search } : {}),
  });

  const mints = vaults
    .map((v) => v.shareMint)
    .filter((m): m is string => m !== null);
  const perfMap = await tokenPriceRepo.getVaultPerformanceByMints(mints);

  const items = await Promise.all(
    vaults.map(async (vault) => {
      const portfolio = await portfolioRepo.findLatestSnapshot(vault.quantId);
      const perf = vault.shareMint
        ? (perfMap.get(vault.shareMint) ?? null)
        : null;
      return formatVaultSummary(vault, portfolio, perf);
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
