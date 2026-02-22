import type { FastifyReply, FastifyRequest } from "fastify";
import type { PortfolioSnapshot } from "@repo/database";
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
  _request: FastifyRequest,
  _reply: FastifyReply
) {
  const vaults = await vaultRepo.findAllActiveVaults();

  const results = await Promise.all(
    vaults.map(async (vault) => {
      const portfolio = await portfolioRepo.findLatestSnapshot(vault.kolId);
      return formatVaultSummary(vault, portfolio);
    })
  );

  return results;
}
