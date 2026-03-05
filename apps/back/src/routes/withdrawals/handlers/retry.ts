import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { prisma } from "@repo/database";
import { type ApiResponse } from "@repo/shared";
import { getGlamClient } from "../../../solana/client.js";
import { getConnection, getKeeper, SHARE_TOKEN_MULTIPLIER } from "../../../solana/config.js";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import { env } from "../../../utils/env.js";
import { logger } from "../../../utils/logger.js";

type RetryRequest = FastifyRequest<{
  Params: { withdrawalId: string };
}>;

/**
 * Retry a FAILED withdrawal: reset to REQUESTED, build a new unsigned
 * queuedRedeem tx for the user to sign.
 */
export async function retryWithdrawal(
  request: RetryRequest,
  reply: FastifyReply,
) {
  const { withdrawalId } = request.params;

  const withdrawal = await withdrawalRepo.findById(withdrawalId);
  if (!withdrawal) {
    logger.error({ withdrawalId }, "Withdrawal not found for retry");
    return reply.status(404).send({
      success: false,
      error: "Withdrawal not found",
    } satisfies ApiResponse<never>);
  }

  // Verify ownership and fetch wallet address
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
    select: { id: true, walletAddress: true },
  });
  if (!user || withdrawal.userId !== user.id) {
    return reply.status(403).send({
      success: false,
      error: "Forbidden",
    } satisfies ApiResponse<never>);
  }

  if (withdrawal.status !== "FAILED") {
    return reply.status(400).send({
      success: false,
      error: `Cannot retry withdrawal in status "${withdrawal.status}"`,
    } satisfies ApiResponse<never>);
  }

  if (withdrawal.errorCount >= env.WITHDRAWAL_MAX_RETRIES) {
    return reply.status(400).send({
      success: false,
      error: `Max retries (${env.WITHDRAWAL_MAX_RETRIES}) exceeded`,
    } satisfies ApiResponse<never>);
  }

  if (!user.walletAddress) {
    return reply.status(400).send({
      success: false,
      error: "User has no wallet address on file",
    } satisfies ApiResponse<never>);
  }

  const vault = await vaultRepo.findVaultById(withdrawal.vaultId);
  if (!vault?.statePda) {
    return reply.status(404).send({
      success: false,
      error: "Vault not found or missing state PDA",
    } satisfies ApiResponse<never>);
  }

  // Reset to REQUESTED
  await withdrawalRepo.updateStatus(withdrawalId, "REQUESTED", {
    failedAt: null,
    errorMessage: null,
    redeemTxSignature: null,
  });

  // Build unsigned queuedRedeem tx
  try {
    const signerPubkey = new PublicKey(user.walletAddress);
    const statePda = new PublicKey(vault.statePda);
    const glamClient = getGlamClient(statePda);
    const keeper = getKeeper();
    const connection = getConnection();

    const amountBN = new BN(Math.round(withdrawal.amount * SHARE_TOKEN_MULTIPLIER));

    const priceIxs = await glamClient.price.priceVaultIxs();
    const redeemIx = await glamClient.invest.txBuilder.queuedRedeemIx(
      amountBN,
      signerPubkey,
    );

    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction();
    transaction.add(...priceIxs, redeemIx);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signerPubkey;
    transaction.partialSign(keeper);

    const serialized = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    logger.info({ withdrawalId }, "Retry: redeem tx built for user signing");

    return {
      success: true,
      data: { transaction: serialized, withdrawalId },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ withdrawalId, err }, "Failed to build retry redeem tx");
    return reply.status(500).send({
      success: false,
      error: `Failed to build redeem transaction: ${msg}`,
    } satisfies ApiResponse<never>);
  }
}
