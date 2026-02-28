import { PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { getGlamClient } from "../solana/client.js";
import { getConnection, getKeeper } from "../solana/config.js";
import * as withdrawalRepo from "../store/withdrawal.repository.js";
import * as vaultRepo from "../store/vault.repository.js";
import { notifyUser } from "../infra/websocket.js";
import { logger } from "../utils/logger.js";
import type { WithdrawalJobResult } from "../queue/withdrawal-queue.js";

/**
 * Process a batch of withdrawal requests:
 * 1. Fetch all REQUESTED records for the batch
 * 2. Transition to PROCESSING, notify users
 * 3. Build + send queued redeem tx (keeper signs as vault manager)
 * 4. On success: transition to CLAIMABLE, notify users
 * 5. On failure: transition to FAILED
 */
export async function processWithdrawalBatch(
  batchId: string,
  vaultId: string,
): Promise<WithdrawalJobResult> {
  const requests = await withdrawalRepo.findByBatchId(batchId);
  const pending = requests.filter((r) => r.status === "REQUESTED");

  if (pending.length === 0) {
    logger.info({ batchId }, "No pending requests in batch, skipping");
    return { processedCount: 0, failedCount: 0 };
  }

  // Sum total shares to redeem
  const totalAmount = pending.reduce((sum, r) => sum + r.amount, 0);

  logger.info(
    { batchId, vaultId, count: pending.length, totalAmount },
    "Processing withdrawal batch",
  );

  // Transition to PROCESSING
  const now = new Date();
  await withdrawalRepo.updateBatchStatus(batchId, "REQUESTED", "PROCESSING", {
    processingAt: now,
  });

  for (const req of pending) {
    notifyUser(req.userId, "withdrawal:status", {
      withdrawalId: req.id,
      status: "PROCESSING",
      timestamp: now.toISOString(),
    });
  }

  // Lookup vault
  const vault = await vaultRepo.findVaultById(vaultId);
  if (!vault?.statePda) {
    await failBatch(batchId, pending, "Vault not found or missing state PDA");
    return { processedCount: 0, failedCount: pending.length };
  }

  try {
    const txSig = await executeQueuedRedeem(
      vault.statePda,
      totalAmount,
    );

    // Transition to CLAIMABLE
    const claimableAt = new Date();
    await withdrawalRepo.updateBatchStatus(
      batchId,
      "PROCESSING",
      "CLAIMABLE",
      { claimableAt, redeemTxSignature: txSig },
    );

    for (const req of pending) {
      notifyUser(req.userId, "withdrawal:status", {
        withdrawalId: req.id,
        status: "CLAIMABLE",
        timestamp: claimableAt.toISOString(),
        redeemTxSignature: txSig,
      });
    }

    logger.info({ batchId, txSig }, "Batch redeem confirmed, now CLAIMABLE");
    return { processedCount: pending.length, failedCount: 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failBatch(batchId, pending, msg);
    return { processedCount: 0, failedCount: pending.length };
  }
}

async function executeQueuedRedeem(
  statePdaStr: string,
  totalAmount: number,
): Promise<string> {
  const statePda = new PublicKey(statePdaStr);
  const glamClient = getGlamClient(statePda);
  const keeper = getKeeper();
  const connection = getConnection();

  // Convert share amount to 9-decimal BN
  const amountBN = new BN(Math.round(totalAmount * 1_000_000_000));

  // Price vault + build queued redeem
  const priceIxs = await glamClient.price.priceVaultIxs();
  const redeemIx = await glamClient.invest.txBuilder.queuedRedeemIx(
    amountBN,
    keeper.publicKey,
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction();
  transaction.add(...priceIxs, redeemIx);
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = keeper.publicKey;
  transaction.sign(keeper);

  const txSig = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: true },
  );
  await connection.confirmTransaction(txSig, "confirmed");

  return txSig;
}

async function failBatch(
  batchId: string,
  requests: Array<{ id: string; userId: string; errorCount: number }>,
  errorMessage: string,
): Promise<void> {
  const failedAt = new Date();

  for (const req of requests) {
    await withdrawalRepo.updateStatus(req.id, "FAILED", {
      errorMessage,
      errorCount: req.errorCount + 1,
      failedAt,
    });

    notifyUser(req.userId, "withdrawal:status", {
      withdrawalId: req.id,
      status: "FAILED",
      timestamp: failedAt.toISOString(),
      errorMessage,
    });
  }

  logger.error({ batchId, errorMessage }, "Batch withdrawal failed");
}
