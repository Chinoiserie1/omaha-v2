import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  fundSolRequestSchema,
  type ApiResponse,
  type FundSolResponse,
} from "@repo/shared";
import { getConnection } from "../../../solana/config.js";
import { buildFundSolPlan } from "../../../services/fund-sol.service.js";
import { buildFundSolTransaction } from "../../../services/fund-sol-tx.builder.js";
import { logger } from "../../../utils/logger.js";

const MAX_SOL_BALANCE = 0.05;

export async function fundSol(request: FastifyRequest, reply: FastifyReply) {
  const parsed = fundSolRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const { amountUsd, signerPublicKey } = parsed.data;

  try {
    // Check SOL balance — reject if already above threshold
    const connection = getConnection();
    const balance = await connection.getBalance(new PublicKey(signerPublicKey));
    const balanceSol = balance / LAMPORTS_PER_SOL;

    if (balanceSol >= MAX_SOL_BALANCE) {
      return reply.status(400).send({
        success: false,
        error: `SOL balance is already ${balanceSol.toFixed(4)} SOL (max ${MAX_SOL_BALANCE} SOL)`,
      } satisfies ApiResponse<never>);
    }

    const plan = await buildFundSolPlan(amountUsd, signerPublicKey);
    const builtTx = await buildFundSolTransaction(signerPublicKey, plan);

    return {
      success: true,
      data: { transaction: builtTx.transaction, quote: plan.quote },
    } satisfies ApiResponse<FundSolResponse>;
  } catch (err) {
    logger.error(
      { err, amountUsd, signerPublicKey },
      "Failed to build fund-sol transaction",
    );
    return reply.status(500).send({
      success: false,
      error: "Failed to build swap transaction",
    } satisfies ApiResponse<never>);
  }
}
