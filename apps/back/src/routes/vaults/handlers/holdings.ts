import { PublicKey } from "@solana/web3.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as holdingsRepo from "../../../store/holdings.repository.js";
import {
  getVaultHoldings,
  holdingsToAllocationPcts,
} from "../../../solana/vault-holdings.js";
import { logger } from "../../../utils/logger.js";
import type {
  VaultHoldingWithPct,
  VaultHoldingsResponse,
} from "@repo/shared";
import type { Prisma } from "@repo/database";

type GetHoldingsRequest = FastifyRequest<{ Params: { id: string } }>;
type HoldingsSnapshot = Awaited<
  ReturnType<typeof holdingsRepo.findCurrentByKolVault>
>;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isFresh(startDate: Date): boolean {
  return Date.now() - startDate.getTime() < CACHE_TTL_MS;
}

function snapshotToResponse(
  snapshot: NonNullable<HoldingsSnapshot>,
): VaultHoldingsResponse {
  return {
    holdings: snapshot.holdings as unknown as VaultHoldingWithPct[],
    totalEquityUsd: snapshot.totalEquityUsd,
    snapshotId: snapshot.id,
    snapshotDate: snapshot.startDate.toISOString(),
  };
}

export async function getVaultHoldingsHandler(
  request: GetHoldingsRequest,
  reply: FastifyReply,
) {
  const vault = await vaultRepo.findVaultById(request.params.id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }

  // Check for fresh cached snapshot
  const cached = await holdingsRepo.findCurrentByKolVault(vault.id);
  if (cached && isFresh(cached.startDate)) {
    return snapshotToResponse(cached);
  }

  // Dry-run vaults have no real on-chain PDA — skip GLAM fetch
  if (vault.dryRun) {
    if (cached) {
      return snapshotToResponse(cached);
    }
    return reply
      .status(404)
      .send({ error: "No holdings snapshot available for dry-run vault" });
  }

  // Fetch live from GLAM
  try {
    const statePda = new PublicKey(vault.statePda);
    const { holdings, totalEquityUsd } = await getVaultHoldings(statePda);
    const pcts = holdingsToAllocationPcts(holdings, totalEquityUsd);

    const holdingsWithPct: VaultHoldingWithPct[] = holdings.map((h) => ({
      ...h,
      percentage: pcts.get(h.mint) ?? 0,
    }));

    const snapshot = await holdingsRepo.createSnapshot({
      kolVaultId: vault.id,
      holdings: holdingsWithPct as unknown as Prisma.InputJsonValue,
      totalEquityUsd,
    });

    const response: VaultHoldingsResponse = {
      holdings: holdingsWithPct,
      totalEquityUsd,
      snapshotId: snapshot.id,
      snapshotDate: snapshot.startDate.toISOString(),
    };
    return response;
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : err, vaultId: vault.id },
      "Failed to fetch live holdings from GLAM",
    );

    // Fall back to stale cached snapshot
    if (cached) {
      return snapshotToResponse(cached);
    }

    return reply.status(502).send({ error: "Unable to fetch vault holdings" });
  }
}
