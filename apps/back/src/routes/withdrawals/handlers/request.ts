import type { FastifyReply, FastifyRequest } from "fastify";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { prisma } from "@repo/database";
import { createWithdrawalSchema, type ApiResponse } from "@repo/shared";
import {
  createRequestWithdrawInstruction,
  findPendingWithdrawPda,
  findShareMintPda,
  TOKEN_2022_PROGRAM_ID,
} from "@repo/omaha-programs-sdk";
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
    return buildAndReturnTx(reply, vault.statePda, vault.shareMint, updated.amount, signerPubkey, updated);
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

  return buildAndReturnTx(reply, vault.statePda, vault.shareMint, amount, signerPubkey, withdrawal);
}

async function buildAndReturnTx(
  reply: FastifyReply,
  statePdaStr: string,
  shareMintStr: string | null,
  amount: number,
  signerPubkey: PublicKey,
  withdrawal: { id: string },
) {
  try {
    const statePda = new PublicKey(statePdaStr);
    const connection = getConnection();

    const shares = BigInt(Math.round(amount * SHARE_TOKEN_MULTIPLIER));

    const shareMint = shareMintStr
      ? new PublicKey(shareMintStr)
      : findShareMintPda(statePda)[0];

    const withdrawerShareAta = await getAssociatedTokenAddress(
      shareMint,
      signerPubkey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    const [pendingWithdraw] = findPendingWithdrawPda(statePda, signerPubkey);

    const redeemIx = createRequestWithdrawInstruction({
      withdrawer: signerPubkey,
      withdrawerShareAta,
      shareMint,
      vaultState: statePda,
      pendingWithdraw,
      shares,
    });

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
