import type { FastifyReply, FastifyRequest } from "fastify";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { prisma } from "@repo/database";
import { createWithdrawalSchema, type ApiResponse } from "@repo/shared";
import { getGlamClient } from "../../../solana/client.js";
import { getConnection, SHARE_TOKEN_MULTIPLIER } from "../../../solana/config.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import {
  computeBatchId,
  computeIdempotencyKey,
} from "../../../queue/batch-utils.js";
import { env } from "../../../utils/env.js";
import { logger } from "../../../utils/logger.js";

type RequestBody = FastifyRequest<{
  Params: { vaultId: string };
  Body: { amount: number; signerPublicKey: string };
}>;

/**
 * Build an unsigned queuedRedeem transaction for the user to sign.
 * Creates the DB record, builds queuedRedeemIx(amount, userPubkey),
 * returns the unsigned serialized tx to the client for signing.
 */
export async function requestWithdrawal(
  request: RequestBody,
  reply: FastifyReply,
) {
  const { vaultId } = request.params;
  const bodyResult = createWithdrawalSchema.safeParse(request.body);

  if (!bodyResult.success) {
    logger.error(
      { vaultId, errors: bodyResult.error.errors },
      "Withdrawal request validation failed",
    );
    return reply.status(400).send({
      success: false,
      error: bodyResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const { amount, signerPublicKey } = bodyResult.data;

  // Validate signer public key
  let signerPubkey: PublicKey;
  try {
    signerPubkey = new PublicKey(signerPublicKey);
  } catch {
    return reply.status(400).send({
      success: false,
      error: "Invalid signer public key",
    } satisfies ApiResponse<never>);
  }

  // Resolve user
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });
  if (!user) {
    logger.error(
      { privyId: request.privyUserId, vaultId },
      "User not found for withdrawal request",
    );
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  // Lookup vault
  const vault = await vaultRepo.findVaultById(vaultId);
  if (!vault?.statePda) {
    return reply.status(404).send({
      success: false,
      error: "Vault not found or missing state PDA",
    } satisfies ApiResponse<never>);
  }

  // Compute batch + idempotency
  const now = Date.now();
  const batchId = computeBatchId(vaultId, now);
  const idempotencyKey = computeIdempotencyKey(user.id, vaultId, batchId);

  // Check for existing request in this batch window
  const existing = await withdrawalRepo.findByIdempotencyKey(idempotencyKey);

  if (existing) {
    const updated = await withdrawalRepo.addAmountToExisting(
      existing.id,
      amount,
    );
    logger.info(
      { withdrawalId: updated.id, newAmount: updated.amount },
      "Merged withdrawal request into existing",
    );
    // Rebuild the transaction with the updated amount
    return buildAndReturnTx(
      reply,
      vault.statePda,
      updated.amount,
      signerPubkey,
      updated,
    );
  }

  // Persist wallet address on user (set once, idempotent)
  if (!user.walletAddress) {
    await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: signerPublicKey },
    });
  }

  // Create new request
  const withdrawal = await withdrawalRepo.createRequest({
    userId: user.id,
    kolVaultId: vaultId,
    amount,
    idempotencyKey,
    batchId,
  });

  const windowSec = env.WITHDRAWAL_BATCH_WINDOW_MS / 1000;
  const windowMin = windowSec / 60;
  logger.info(
    {
      withdrawalId: withdrawal.id,
      batchId,
      userId: user.id,
      vaultId,
      amount,
      status: withdrawal.status,
      idempotencyKey,
      requestedAt: withdrawal.requestedAt,
      batchWindowMs: env.WITHDRAWAL_BATCH_WINDOW_MS,
      batchWindowSec: windowSec,
      batchWindowMin: windowMin,
      signerPublicKey,
    },
    `[DEBUG] Withdrawal created — batch window: ${windowMin}min (${windowSec}s)`,
  );

  return buildAndReturnTx(
    reply,
    vault.statePda,
    amount,
    signerPubkey,
    withdrawal,
  );
}

async function buildAndReturnTx(
  reply: FastifyReply,
  statePdaStr: string,
  amount: number,
  signerPubkey: PublicKey,
  withdrawal: { id: string },
) {
  try {
    const statePda = new PublicKey(statePdaStr);
    const glamClient = getGlamClient(statePda);
    const connection = getConnection();

    const amountBN = new BN(Math.round(amount * SHARE_TOKEN_MULTIPLIER));

    logger.info(`signer ${signerPubkey}`);

    // Build queued redeem for the user's pubkey (no pricing needed)
    const redeemIx = await glamClient.invest.txBuilder.queuedRedeemIx(
      amountBN,
      signerPubkey,
    );

    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction();
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      redeemIx,
    );
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signerPubkey;

    const serialized = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    logger.info(
      {
        withdrawalId: withdrawal.id,
        signer: signerPubkey.toBase58(),
        totalIxCount: transaction.instructions.length,
      },
      "Redeem transaction built for user signing",
    );

    return reply.status(201).send({
      success: true,
      data: { transaction: serialized, withdrawalId: withdrawal.id },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      { withdrawalId: withdrawal.id, err },
      "Failed to build redeem transaction",
    );
    return reply.status(500).send({
      success: false,
      error: `Failed to build redeem transaction: ${msg}`,
    } satisfies ApiResponse<never>);
  }
}
