import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiResponse } from "@repo/shared";
import { prisma } from "@repo/database";
import { createQuantVault } from "../../../solana/vault-setup.js";
import { logger } from "../../../utils/logger.js";

type CreateVaultRequest = FastifyRequest<{
  Body: { quantId: string; dryRun?: boolean };
}>;

export async function createVault(
  request: CreateVaultRequest,
  reply: FastifyReply,
) {
  const { quantId, dryRun = true } = request.body;

  if (!quantId || typeof quantId !== "string") {
    return reply.status(400).send({
      success: false,
      error: "quantId is required",
    } satisfies ApiResponse<never>);
  }

  const quant = await prisma.quant.findUnique({
    where: { id: quantId },
    include: { user: true },
  });
  if (!quant) {
    return reply.status(404).send({
      success: false,
      error: `Quant not found: ${quantId}`,
    } satisfies ApiResponse<never>);
  }

  const existing = await prisma.vault.findUnique({
    where: { quantId: quant.id },
  });
  if (existing) {
    return reply.status(409).send({
      success: false,
      error: `Vault already exists for quant ${quantId}`,
    } satisfies ApiResponse<never>);
  }

  const username = quant.user.twitterUsername ?? quantId;

  try {
    logger.info({ quantId, username }, "Creating vault via API");
    const { txSig, statePda, shareMint, baseTokenAta } =
      await createQuantVault(username);

    const vaultName = `quant-${username}`;
    const vaultSymbol = `Q-${username.slice(0, 6).toUpperCase()}`;

    const vault = await prisma.vault.create({
      data: {
        quantId: quant.id,
        statePda,
        shareMint,
        baseTokenAta,
        vaultName,
        vaultSymbol,
        dryRun,
      },
    });

    logger.info({ vaultId: vault.id, statePda }, "Vault created via API");

    return {
      success: true,
      data: {
        id: vault.id,
        statePda,
        shareMint,
        vaultName,
        vaultSymbol,
        dryRun,
        txSig,
      },
    };
  } catch (err) {
    logger.error({ err, quantId }, "Failed to create vault");
    return reply.status(500).send({
      success: false,
      error: "Failed to create vault",
    } satisfies ApiResponse<never>);
  }
}
