import { PublicKey, Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  createFulfillWithdrawInstruction,
  findPendingWithdrawPda,
  findShareMintPda,
  findVaultShareAta,
} from "@repo/omaha-programs-sdk";
import { getConnection, getAdmin, USDC_MINT } from "../solana/config.js";
import { computeSharePrice } from "./share-price.service.js";
import * as withdrawalRepo from "../store/withdrawal.repository.js";
import * as vaultRepo from "../store/vault.repository.js";
import { notifyUser } from "../infra/websocket.js";
import { logger } from "../utils/logger.js";
import type { FulfillJobResult } from "../queue/withdrawal-queue.js";

/**
 * Process the fulfill step for a vault:
 * 1. Find all PROCESSING records for the vault
 * 2. For each: build FulfillWithdraw instruction
 * 3. On success: transition directly to CLAIMED (no separate claim step)
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

  const statePda = new PublicKey(vault.statePda);
  const shareMint = vault.shareMint
    ? new PublicKey(vault.shareMint)
    : findShareMintPda(statePda)[0];

  try {
    // Compute current share price for all fulfills
    const { onChainPrice } = await computeSharePrice(statePda);

    const txSig = await executeFulfillBatch(
      statePda,
      vault.baseTokenAta ? new PublicKey(vault.baseTokenAta) : null,
      shareMint,
      requests,
      onChainPrice,
    );

    // Custom vault FulfillWithdraw transfers base tokens directly
    // → transition straight to CLAIMED (no CLAIMABLE step)
    const claimedAt = new Date();
    const ids = requests.map((r) => r.id);
    await withdrawalRepo.updateManyStatus(ids, "CLAIMED", { claimedAt });

    // Notify each user
    for (const req of requests) {
      notifyUser(req.userId, "withdrawal:status", {
        withdrawalId: req.id,
        status: "CLAIMED",
        timestamp: claimedAt.toISOString(),
      });
    }

    logger.info({ vaultId, txSig }, "Fulfill confirmed, requests now CLAIMED");
    return { processedCount: requests.length, failedCount: 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failRequests(requests, msg);
    return { processedCount: 0, failedCount: requests.length };
  }
}

async function executeFulfillBatch(
  statePda: PublicKey,
  vaultBaseAta: PublicKey | null,
  shareMint: PublicKey,
  requests: Array<{ id: string; userId: string; amount: number }>,
  newSharePrice: bigint,
): Promise<string> {
  const admin = getAdmin();
  const connection = getConnection();

  // Derive vault's base token ATA if not provided
  const actualVaultBaseAta = vaultBaseAta ?? await getAssociatedTokenAddress(
    USDC_MINT,
    statePda,
    true,
  );

  // Derive vault share escrow ATA
  const vaultShareAta = findVaultShareAta(shareMint, statePda);

  // Build FulfillWithdraw instruction for each request
  const fulfillIxs = await Promise.all(
    requests.map(async (req) => {
      // Look up user wallet address
      const { prisma } = await import("@repo/database");
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { walletAddress: true },
      });

      if (!user?.walletAddress) {
        throw new Error(`User ${req.userId} has no wallet address`);
      }

      const withdrawer = new PublicKey(user.walletAddress);
      const [pendingWithdraw] = findPendingWithdrawPda(statePda, withdrawer);

      const withdrawerBaseAta = await getAssociatedTokenAddress(
        USDC_MINT,
        withdrawer,
      );

      return createFulfillWithdrawInstruction({
        admin: admin.publicKey,
        vaultState: statePda,
        pendingWithdraw,
        vaultBaseAta: actualVaultBaseAta,
        withdrawerBaseAta,
        withdrawer,
        vaultShareAta,
        shareMint,
        newSharePrice,
      });
    }),
  );

  logger.info(
    { statePda: statePda.toBase58(), fulfillCount: fulfillIxs.length },
    "Building fulfill transaction",
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    ...fulfillIxs,
  );
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = admin.publicKey;
  transaction.sign(admin);

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
