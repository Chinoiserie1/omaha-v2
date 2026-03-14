import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@repo/database";
import { reconcileWithdrawalSchema, type ApiResponse } from "@repo/shared";
import {
  findPendingWithdrawPda,
  deserializePendingWithdraw,
} from "@repo/omaha-programs-sdk";
import { getConnection, SHARE_TOKEN_MULTIPLIER } from "../../../solana/config.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import { enqueueFulfillJob } from "../../../queue/withdrawal-queue.js";
import { logger } from "../../../utils/logger.js";

type ReconcileRequest = FastifyRequest<{
  Params: { vaultId: string };
  Body: { walletAddress: string };
}>;

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

  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });
  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  if (user.walletAddress && user.walletAddress !== walletAddress) {
    return reply.status(403).send({
      success: false,
      error: "Wallet address does not match account",
    } satisfies ApiResponse<never>);
  }

  const vault = await vaultRepo.findVaultById(vaultId);
  if (!vault?.statePda) {
    return reply.status(404).send({
      success: false,
      error: "Vault not found or missing state PDA",
    } satisfies ApiResponse<never>);
  }

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
  const connection = getConnection();

  const [pendingWithdrawPda] = findPendingWithdrawPda(statePda, walletPubkey);
  const pendingAccount = await connection.getAccountInfo(pendingWithdrawPda);

  if (!pendingAccount) {
    logger.debug(
      { vaultId, userId: user.id },
      "Reconcile: no on-chain pending withdraw — no divergence",
    );
    return { success: true, data: null };
  }

  const pendingWithdraw = deserializePendingWithdraw(Buffer.from(pendingAccount.data));

  const existing = await withdrawalRepo.findActiveByUserAndVault(user.id, vaultId);
  if (existing) {
    logger.info(
      { withdrawalId: existing.id, vaultId, userId: user.id },
      "Reconcile: active withdrawal already exists",
    );
    return { success: true, data: existing };
  }

  const onChainAmount = Number(pendingWithdraw.shares) / SHARE_TOKEN_MULTIPLIER;
  const now = new Date();
  const idempotencyKey = `reconciled_${user.id}_${vaultId}_${Date.now()}`;
  const batchId = `reconciled_${vaultId}_${Date.now()}`;

  const existingByKey = await withdrawalRepo.findByIdempotencyKey(idempotencyKey);
  if (existingByKey) {
    return { success: true, data: existingByKey };
  }

  const withdrawal = await withdrawalRepo.createRequest({
    userId: user.id,
    vaultId,
    amount: onChainAmount,
    idempotencyKey,
    batchId,
  });

  const updated = await withdrawalRepo.updateStatus(withdrawal.id, "PROCESSING", {
    processingAt: now,
  });

  await enqueueFulfillJob(vaultId);

  logger.info(
    {
      withdrawalId: updated.id,
      vaultId,
      userId: user.id,
      amount: onChainAmount,
    },
    "Reconcile: created PROCESSING record for on-chain divergence",
  );

  return { success: true, data: updated };
}
