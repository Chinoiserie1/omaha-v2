import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import { getGlamClient } from "../solana/client.js";
import { getConnection, getKeeper } from "../solana/config.js";
import * as withdrawalRepo from "../store/withdrawal.repository.js";
import * as vaultRepo from "../store/vault.repository.js";
import { notifyUser } from "../infra/websocket.js";
import { logger } from "../utils/logger.js";
import type { FulfillJobResult } from "../queue/withdrawal-queue.js";

/**
 * Process the fulfill step for a vault:
 * 1. Find all PROCESSING records for the vault
 * 2. Call fulfillIx (keeper signs as vault manager)
 * 3. On success: transition to CLAIMABLE, notify users
 * 4. On failure: transition to FAILED
 */
export async function processFulfillBatch(
  vaultId: string,
): Promise<FulfillJobResult> {
  const requests = await withdrawalRepo.findPendingFulfill(vaultId);

  logger.info(
    {
      vaultId,
      count: requests.length,
      requests: requests.map((r) => ({
        id: r.id,
        userId: r.userId,
        amount: r.amount,
        status: r.status,
        batchId: r.batchId,
        processingAt: r.processingAt,
        redeemTxSignature: r.redeemTxSignature,
      })),
    },
    `[DEBUG] processFulfillBatch — found ${requests.length} PROCESSING requests`,
  );

  if (requests.length === 0) {
    return { processedCount: 0, failedCount: 0 };
  }

  const vault = await vaultRepo.findVaultById(vaultId);
  if (!vault?.statePda) {
    await failRequests(requests, "Vault not found or missing state PDA");
    return { processedCount: 0, failedCount: requests.length };
  }

  try {
    const txSig = await executeFulfill(vault.statePda);

    // Transition all to CLAIMABLE in a single query
    const claimableAt = new Date();
    const ids = requests.map((r) => r.id);
    await withdrawalRepo.updateManyStatus(ids, "CLAIMABLE", { claimableAt });

    // Notify each user individually
    for (const req of requests) {
      notifyUser(req.userId, "withdrawal:status", {
        withdrawalId: req.id,
        status: "CLAIMABLE",
        timestamp: claimableAt.toISOString(),
      });
    }

    logger.info({ vaultId, txSig }, "Fulfill confirmed, requests now CLAIMABLE");
    return { processedCount: requests.length, failedCount: 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failRequests(requests, msg);
    return { processedCount: 0, failedCount: requests.length };
  }
}

async function executeFulfill(statePdaStr: string): Promise<string> {
  const statePda = new PublicKey(statePdaStr);
  const glamClient = getGlamClient(statePda);
  const keeper = getKeeper();
  const connection = getConnection();

  logger.info({ statePda: statePdaStr }, "Building fulfill transaction");

  // Price the vault first (required by GLAM before fulfill)
  const priceIxs = await glamClient.price.priceVaultIxs();

  const fulfillIx = await glamClient.invest.txBuilder.fulfillIx(
    null,
    keeper.publicKey,
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    ...priceIxs,
    fulfillIx,
  );
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = keeper.publicKey;
  transaction.sign(keeper);

  logger.info({ blockhash }, "Fulfill tx signed, sending to network");

  const txSig = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: true },
  );
  logger.info({ txSig }, "Fulfill tx sent, awaiting confirmation");

  const { blockhash: confirmBlockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const confirmation = await connection.confirmTransaction(
    { signature: txSig, blockhash: confirmBlockhash, lastValidBlockHeight },
    "confirmed",
  );

  if (confirmation.value.err) {
    const errorDetail = JSON.stringify(confirmation.value.err);
    logger.error(
      { txSig, onChainError: confirmation.value.err },
      "Fulfill tx failed on-chain",
    );
    throw new Error(`Fulfill transaction failed on-chain: ${errorDetail}`);
  }

  logger.info({ txSig }, "Fulfill tx confirmed on-chain");

  return txSig;
}

async function failRequests(
  requests: Array<{ id: string; userId: string; errorCount: number }>,
  errorMessage: string,
): Promise<void> {
  const failedAt = new Date();
  const ids = requests.map((r) => r.id);
  await withdrawalRepo.updateManyStatus(ids, "FAILED", {
    errorMessage,
    failedAt,
  });

  // Increment error counts individually (each may differ) and notify
  for (const req of requests) {
    await withdrawalRepo.incrementErrorCount(req.id);
    notifyUser(req.userId, "withdrawal:status", {
      withdrawalId: req.id,
      status: "FAILED",
      timestamp: failedAt.toISOString(),
      errorMessage,
    });
  }

  logger.error({ count: requests.length, errorMessage }, "Fulfill batch failed");
}
