import type { FastifyReply, FastifyRequest } from "fastify";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";
import { getLogoUriByMints } from "../../../store/asset.repository.js";

type GetVaultRequest = FastifyRequest<{
  Params: { id: string };
}>;

export async function getVault(request: GetVaultRequest, reply: FastifyReply) {
  const vault = await vaultRepo.findVaultById(request.params.id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }

  const portfolio = await portfolioRepo.findLatestSnapshot(vault.quantId);

  // Enrich allocations with token logo URIs
  let enrichedAllocations: unknown[] = [];
  if (portfolio) {
    const rawAllocations = portfolio.allocations as { mint?: string }[];
    const mints = rawAllocations
      .map((a) => a.mint)
      .filter((m): m is string => !!m);
    const logoMap = await getLogoUriByMints(mints);
    enrichedAllocations = rawAllocations.map((a) => ({
      ...a,
      logoUri: a.mint ? logoMap.get(a.mint) ?? null : null,
    }));
  }

  return {
    id: vault.id,
    name: vault.vaultName,
    description: vault.about,
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
          allocations: enrichedAllocations,
          changes: portfolio.changes,
          updatedAt: portfolio.createdAt,
        }
      : null,
  };
}
