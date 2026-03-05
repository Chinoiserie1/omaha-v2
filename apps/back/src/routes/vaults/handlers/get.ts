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

  const portfolio = await portfolioRepo.findLatestSnapshot(vault.quantId);

  return {
    id: vault.id,
    name: vault.vaultName,
    quantUsername: vault.quant?.user?.twitterUsername,
    quantId: vault.quantId,
    glamStatePda: vault.statePda,
    glamVaultPda: vault.glamVaultPda,
    mintAddress: vault.mintAddress,
    isActive: vault.isActive,
    about: vault.about,
    dataSource: vault.dataSource,
    performanceCalc: vault.performanceCalc,
    disclosure: vault.disclosure,
    quant: {
      id: vault.quant?.user?.id,
      username: vault.quant?.user?.twitterUsername,
      displayName: vault.quant?.user?.name,
      avatarUrl: vault.quant?.user?.profileImageUrl,
      bio: vault.quant?.user?.bio,
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
