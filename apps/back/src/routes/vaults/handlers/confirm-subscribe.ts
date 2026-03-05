import type { FastifyReply, FastifyRequest } from "fastify";
import * as vaultRepo from "../../../store/vault.repository.js";
import { rebalanceVault } from "../../../services/rebalancer.service.js";
import { captureSnapshotIfChanged } from "../../../services/portfolio-snapshot.service.js";
import { logger } from "../../../utils/logger.js";

type ConfirmSubscribeRequest = FastifyRequest<{
  Params: { id: string };
  Body: { txSignature: string; signerPublicKey?: string };
}>;

export async function confirmSubscribe(
  request: ConfirmSubscribeRequest,
  reply: FastifyReply,
) {
  const { id } = request.params;
  const { txSignature, signerPublicKey } = request.body;

  if (!txSignature || typeof txSignature !== "string") {
    return reply.status(400).send({ error: "txSignature is required" });
  }

  const vault = await vaultRepo.findVaultById(id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }

  logger.info(
    { vaultId: id, quantId: vault.quantId, txSignature },
    "Deposit confirmed, triggering rebalance",
  );

  // Fire rebalance asynchronously — don't block the response
  setImmediate(() => {
    rebalanceVault(vault.quantId).catch((err) => {
      logger.error(
        { err, vaultId: id, quantId: vault.quantId },
        "Post-deposit rebalance failed",
      );
    });
  });

  // Capture portfolio snapshot after deposit (async, non-blocking)
  if (signerPublicKey) {
    setImmediate(() => {
      captureSnapshotIfChanged(signerPublicKey).catch((err) => {
        logger.warn(
          { err, address: signerPublicKey },
          "Post-deposit portfolio snapshot failed",
        );
      });
    });
  }

  return { success: true, message: "Rebalance triggered" };
}
