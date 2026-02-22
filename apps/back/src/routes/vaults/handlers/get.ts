import type { FastifyReply, FastifyRequest } from "fastify";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";

type GetVaultRequest = FastifyRequest<{
  Params: { id: string };
}>;

export async function getVault(request: GetVaultRequest, reply: FastifyReply) {
  const vault = await vaultRepo.findVaultById(request.params.id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }

  const portfolio = await portfolioRepo.findLatestSnapshot(vault.kolId);

  return {
    id: vault.id,
    name: vault.name,
    description: vault.description,
    kolUsername: vault.kolUsername,
    kolId: vault.kolId,
    glamStatePda: vault.statePda,
    glamVaultPda: vault.glamVaultPda,
    isActive: vault.isActive,
    kol: {
      id: vault.kol.id,
      username: vault.kol.username,
      displayName: vault.kol.displayName,
      avatarUrl: vault.kol.avatarUrl,
      bio: vault.kol.bio,
    },
    portfolio: portfolio
      ? {
          thesisSummary: portfolio.thesisSummary,
          allocations: portfolio.allocations as Record<string, unknown>,
          changes: portfolio.changes,
          updatedAt: portfolio.createdAt,
        }
      : null,
  };
}
