import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@repo/database";
import { type ApiResponse } from "@repo/shared";
import { getConnection, SHARE_TOKEN_MULTIPLIER } from "../../../solana/config.js";
import { computeOnChainSharePrice } from "../../../services/share-price-onchain.service.js";
import {
  getVaultBaseBalance,
  computeBaseToReturn,
} from "../../../services/vault-balance.service.js";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import { buildInstantWithdrawTx } from "./build-instant-tx.js";
import { buildQueuedWithdrawTx } from "./build-queued-tx.js";
import { env } from "../../../utils/env.js";
import { logger } from "../../../utils/logger.js";

type RetryRequest = FastifyRequest<{
  Params: { withdrawalId: string };
}>;

export async function retryWithdrawal(
  request: RetryRequest,
  reply: FastifyReply,
) {
  const { withdrawalId } = request.params;

  const withdrawal = await withdrawalRepo.findById(withdrawalId);
  if (!withdrawal) {
    return reply.status(404).send({
      success: false,
      error: "Withdrawal not found",
    } satisfies ApiResponse<never>);
  }

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

  try {
    const signerPubkey = new PublicKey(user.walletAddress);
    const statePda = new PublicKey(vault.statePda);
    const connection = getConnection();
    const shares = BigInt(Math.round(withdrawal.amount * SHARE_TOKEN_MULTIPLIER));

    const { sharePrice, vaultState } = await computeOnChainSharePrice(statePda);
    const shareMint = vault.shareToken?.mint
      ? new PublicKey(vault.shareToken.mint)
      : vaultState.shareMint;

    const vaultBalance = await getVaultBaseBalance(statePda, vault.baseTokenAta);
    const baseToReturn = computeBaseToReturn(
      shares, sharePrice, vaultState.shareDecimals, vaultState.exitFeeBps,
    );

    const hasSufficientBalance = baseToReturn > 0n && vaultBalance >= baseToReturn;

    const [builtTx, mode] = hasSufficientBalance
      ? [await buildInstantWithdrawTx({
          statePda, shareMint, baseTokenAta: vault.baseTokenAta,
          shares, sharePrice, signerPubkey, connection,
        }), "instant" as const]
      : [await buildQueuedWithdrawTx({
          statePda, shareMint, shares, signerPubkey, connection,
        }), "queued" as const];

    // Only transition to REQUESTED after tx is successfully built
    await withdrawalRepo.updateStatus(withdrawalId, "REQUESTED", {
      failedAt: null,
      errorMessage: null,
      redeemTxSignature: null,
    });

    logger.info({ withdrawalId, mode }, "Retry: redeem tx built for user signing");

    return {
      success: true,
      data: {
        transaction: builtTx.transaction,
        blockhash: builtTx.blockhash,
        lastValidBlockHeight: builtTx.lastValidBlockHeight,
        withdrawalId,
        mode,
      },
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
