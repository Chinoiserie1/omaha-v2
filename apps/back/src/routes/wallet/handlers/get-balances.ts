import type { FastifyReply, FastifyRequest } from "fastify";
import { walletAddressSchema, type ApiResponse, type WalletBalances } from "@repo/shared";
import { getWalletBalances, getConnection } from "@repo/solana";
import { env } from "../../../utils/env.js";

type BalancesRequest = FastifyRequest<{ Params: { address: string } }>;

export async function getBalances(
  request: BalancesRequest,
  reply: FastifyReply,
): Promise<ApiResponse<WalletBalances> | ApiResponse<never>> {
  const paramResult = walletAddressSchema.safeParse(request.params);

  if (!paramResult.success) {
    return reply.status(400).send({
      success: false,
      error: paramResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  if (!env.SOLANA_RPC_URL) {
    return reply.status(503).send({
      success: false,
      error: "Solana RPC not configured",
    } satisfies ApiResponse<never>);
  }

  try {
    const connection = getConnection(env.SOLANA_RPC_URL);
    const balances = await getWalletBalances(connection, paramResult.data.address);

    return {
      success: true,
      data: balances,
    } satisfies ApiResponse<WalletBalances>;
  } catch {
    return reply.status(502).send({
      success: false,
      error: "Failed to fetch balances from Solana RPC",
    } satisfies ApiResponse<never>);
  }
}
