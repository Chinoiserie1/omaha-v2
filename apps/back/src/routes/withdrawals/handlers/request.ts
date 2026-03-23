import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@repo/database";
import { createWithdrawalSchema, type ApiResponse } from "@repo/shared";
import { getConnection, SHARE_TOKEN_MULTIPLIER } from "../../../solana/config.js";
import { computeOnChainSharePrice } from "../../../services/share-price-onchain.service.js";
import {
  getVaultBaseBalance,
  computeBaseToReturn,
} from "../../../services/vault-balance.service.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import {
  computeBatchId,
  computeIdempotencyKey,
} from "../../../queue/batch-utils.js";
import { buildInstantWithdrawTx } from "./build-instant-tx.js";
import { buildQueuedWithdrawTx } from "./build-queued-tx.js";
import { env } from "../../../utils/env.js";
import { logger } from "../../../utils/logger.js";

type RequestBody = FastifyRequest<{
  Params: { vaultId: string };
  Body: { amount: number; signerPublicKey: string };
}>;

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

  let signerPubkey: PublicKey;
  try {
    signerPubkey = new PublicKey(signerPublicKey);
  } catch {
    return reply.status(400).send({
      success: false,
      error: "Invalid signer public key",
    } satisfies ApiResponse<never>);
  }

  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });
  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  const vault = await vaultRepo.findVaultById(vaultId);
  if (!vault?.statePda) {
    return reply.status(404).send({
      success: false,
      error: "Vault not found or missing state PDA",
    } satisfies ApiResponse<never>);
  }

  const now = Date.now();
  const batchId = computeBatchId(vaultId, now);
  const idempotencyKey = computeIdempotencyKey(user.id, vaultId, batchId);

  const existing = await withdrawalRepo.findByIdempotencyKey(idempotencyKey);
  if (existing) {
    const updated = await withdrawalRepo.addAmountToExisting(existing.id, amount);
    logger.info(
      { withdrawalId: updated.id, newAmount: updated.amount },
      "Merged withdrawal request into existing",
    );
    return buildAndReturnTx(reply, vault, updated.amount, signerPubkey, updated);
  }

  if (!user.walletAddress) {
    await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: signerPublicKey },
    });
  }

  const withdrawal = await withdrawalRepo.createRequest({
    userId: user.id,
    vaultId,
    amount,
    idempotencyKey,
    batchId,
  });

  const windowSec = env.WITHDRAWAL_BATCH_WINDOW_MS / 1000;
  logger.info(
    {
      withdrawalId: withdrawal.id,
      batchId,
      userId: user.id,
      vaultId,
      amount,
      status: withdrawal.status,
      batchWindowSec: windowSec,
    },
    `Withdrawal created — batch window: ${windowSec / 60}min`,
  );

  return buildAndReturnTx(reply, vault, amount, signerPubkey, withdrawal);
}

async function buildAndReturnTx(
  reply: FastifyReply,
  vault: { statePda: string; shareToken?: { mint: string } | null; baseTokenAta: string | null },
  amount: number,
  signerPubkey: PublicKey,
  withdrawal: { id: string },
) {
  try {
    const statePda = new PublicKey(vault.statePda);
    const connection = getConnection();
    const shares = BigInt(Math.round(amount * SHARE_TOKEN_MULTIPLIER));

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

    logger.info(
      { withdrawalId: withdrawal.id, signer: signerPubkey.toBase58(), mode },
      `Withdraw tx built (${mode})`,
    );

    return reply.status(201).send({
      success: true,
      data: {
        transaction: builtTx.transaction,
        blockhash: builtTx.blockhash,
        lastValidBlockHeight: builtTx.lastValidBlockHeight,
        withdrawalId: withdrawal.id,
        mode,
      },
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
