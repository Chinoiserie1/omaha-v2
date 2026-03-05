import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@repo/database";
import { reconcileWithdrawalSchema, type ApiResponse } from "@repo/shared";
import { getGlamClient } from "../../../solana/client.js";
import { SHARE_TOKEN_MULTIPLIER } from "../../../solana/config.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import { enqueueFulfillJob } from "../../../queue/withdrawal-queue.js";
import { logger } from "../../../utils/logger.js";

type ReconcileRequest = FastifyRequest<{
  Params: { vaultId: string };
  Body: { walletAddress: string };
}>;

/**
 * Detect on-chain/DB divergence and auto-reconcile.
 *
 * When a queuedRedeem tx lands on-chain but the DB has no matching
 * withdrawal record, this endpoint creates the missing PROCESSING
 * record and enqueues a fulfill job so the regular pipeline takes over.
 */
export async function reconcileWithdrawal(
  request: ReconcileRequest,
  reply: FastifyReply,
) {
  const { vaultId } = request.params;
  const bodyResult = reconcileWithdrawalSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      success: false,
      error: bodyResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const { walletAddress } = bodyResult.data;

  // Resolve user
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });
  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  // Verify wallet belongs to authenticated user
  if (user.walletAddress && user.walletAddress !== walletAddress) {
    return reply.status(403).send({
      success: false,
      error: "Wallet address does not match account",
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

  // Check on-chain state
  let walletPubkey: PublicKey;
  try {
    walletPubkey = new PublicKey(walletAddress);
  } catch {
    return reply.status(400).send({
      success: false,
      error: "Invalid wallet address",
    } satisfies ApiResponse<never>);
  }

  const statePda = new PublicKey(vault.statePda);
  const glamClient = getGlamClient(statePda);

  let pending: Awaited<
    ReturnType<typeof glamClient.invest.fetchPendingRequest>
  > | null = null;

  try {
    pending = await glamClient.invest.fetchPendingRequest(walletPubkey);
  } catch (err) {
    logger.debug({ err, walletAddress, vaultId }, "Error fetching pending request");
  }

  // Check if on-chain pending is a REDEMPTION
  let isRedemption = false;
  if (pending) {
    const reqType = pending.requestType;
    if (typeof reqType === "object" && reqType !== null) {
      isRedemption = "redemption" in reqType;
    }
  }

  if (!pending || !isRedemption) {
    logger.debug(
      { vaultId, userId: user.id, hasPending: !!pending, isRedemption },
      "Reconcile: no on-chain REDEMPTION pending — no divergence",
    );
    return { success: true, data: null };
  }

  // Check if an active withdrawal already exists (already reconciled)
  const existing = await withdrawalRepo.findActiveByUserAndVault(
    user.id,
    vaultId,
  );
  if (existing) {
    logger.info(
      { withdrawalId: existing.id, vaultId, userId: user.id },
      "Reconcile: active withdrawal already exists",
    );
    return { success: true, data: existing };
  }

  // Divergence confirmed — create the missing DB record
  const onChainAmount = pending.outgoing.toNumber() / SHARE_TOKEN_MULTIPLIER;
  const onChainCreatedAt = pending.createdAt.toNumber();
  const now = new Date();

  // Deterministic key based on on-chain createdAt to prevent duplicates
  const idempotencyKey = `reconciled_${user.id}_${vaultId}_${onChainCreatedAt}`;
  const batchId = `reconciled_${vaultId}_${onChainCreatedAt}`;

  // Check idempotency — prevents race condition with concurrent requests
  const existingByKey = await withdrawalRepo.findByIdempotencyKey(idempotencyKey);
  if (existingByKey) {
    logger.info(
      { withdrawalId: existingByKey.id, idempotencyKey },
      "Reconcile: duplicate request caught by idempotency key",
    );
    return { success: true, data: existingByKey };
  }

  const withdrawal = await withdrawalRepo.createRequest({
    userId: user.id,
    vaultId: vaultId,
    amount: onChainAmount,
    idempotencyKey,
    batchId,
  });

  // Transition directly to PROCESSING since the on-chain redeem already landed
  const updated = await withdrawalRepo.updateStatus(withdrawal.id, "PROCESSING", {
    processingAt: now,
  });

  // Enqueue fulfill job to transition PROCESSING → CLAIMABLE
  await enqueueFulfillJob(vaultId);

  logger.info(
    {
      withdrawalId: updated.id,
      vaultId,
      userId: user.id,
      amount: onChainAmount,
      idempotencyKey,
    },
    "Reconcile: created PROCESSING record for on-chain divergence",
  );

  return { success: true, data: updated };
}
