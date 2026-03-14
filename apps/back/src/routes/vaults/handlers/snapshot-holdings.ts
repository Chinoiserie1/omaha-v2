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

type SnapshotHoldingsRequest = FastifyRequest<{ Params: { id: string } }>;

export async function snapshotHoldingsHandler(
  request: SnapshotHoldingsRequest,
  reply: FastifyReply,
) {
  const vault = await vaultRepo.findVaultById(request.params.id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }

  if (vault.dryRun) {
    return reply
      .status(400)
      .send({ error: "Cannot snapshot holdings for a dry-run vault" });
  }

  if (!vault.statePda) {
    return reply
      .status(400)
      .send({ error: "Vault has no on-chain state PDA" });
  }

  try {
    const statePda = new PublicKey(vault.statePda);
    const { holdings, totalEquityUsd } = await getVaultHoldings(statePda);
    const pcts = holdingsToAllocationPcts(holdings, totalEquityUsd);

    const holdingsWithPct: VaultHoldingWithPct[] = holdings.map((h) => ({
      ...h,
      percentage: pcts.get(h.mint) ?? 0,
    }));

    const snapshot = await holdingsRepo.createSnapshot({
      vaultId: vault.id,
      holdings: holdingsWithPct as unknown as Prisma.InputJsonValue,
      totalEquityUsd,
    });

    const response: VaultHoldingsResponse = {
      holdings: holdingsWithPct,
      totalEquityUsd,
      snapshotId: snapshot.id,
      snapshotDate: snapshot.startDate.toISOString(),
    };

    return reply.status(201).send(response);
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : err, vaultId: vault.id },
      "Failed to fetch live holdings for snapshot",
    );

    return reply.status(502).send({ error: "Unable to fetch vault holdings" });
  }
}
