import type { FastifyReply, FastifyRequest } from "fastify";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { prisma } from "@repo/database";
import { type ApiResponse } from "@repo/shared";
import {
  createRequestWithdrawInstruction,
  findPendingWithdrawPda,
  findShareMintPda,
  findVaultShareAta,
  TOKEN_2022_PROGRAM_ID,
} from "@repo/omaha-programs-sdk";
import { getConnection, SHARE_TOKEN_MULTIPLIER } from "../../../solana/config.js";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import * as vaultRepo from "../../../store/vault.repository.js";
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

  await withdrawalRepo.updateStatus(withdrawalId, "REQUESTED", {
    failedAt: null,
    errorMessage: null,
    redeemTxSignature: null,
  });

  try {
    const signerPubkey = new PublicKey(user.walletAddress);
    const statePda = new PublicKey(vault.statePda);
    const connection = getConnection();

    const shares = BigInt(Math.round(withdrawal.amount * SHARE_TOKEN_MULTIPLIER));

    const shareMint = vault.shareMint
      ? new PublicKey(vault.shareMint)
      : findShareMintPda(statePda)[0];

    const withdrawerShareAta = await getAssociatedTokenAddress(
      shareMint,
      signerPubkey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    const [pendingWithdraw] = findPendingWithdrawPda(statePda, signerPubkey);
    const vaultShareAta = findVaultShareAta(shareMint, statePda);

    const redeemIx = createRequestWithdrawInstruction({
      withdrawer: signerPubkey,
      withdrawerShareAta,
      shareMint,
      vaultState: statePda,
      pendingWithdraw,
      vaultShareAta,
      shares,
    });

    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    // Auto-create vault share escrow ATA if it doesn't exist
    const vaultShareAtaInfo = await connection.getAccountInfo(vaultShareAta);

    const transaction = new Transaction();
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    );

    if (!vaultShareAtaInfo) {
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          signerPubkey,
          vaultShareAta,
          statePda,
          shareMint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    transaction.add(redeemIx);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signerPubkey;

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
