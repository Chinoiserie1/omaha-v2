import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey } from "@solana/web3.js";
import {
  walletAddressSchema,
  type ApiResponse,
  type ActiveThesisItem,
} from "@repo/shared";
import { getWalletBalances, getConnection } from "@repo/solana";
import { env } from "../../../utils/env.js";
import { logger } from "../../../utils/logger.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";
import * as tokenPriceRepo from "../../../store/token-price.repository.js";
import { getSharePrice } from "../../../solana/vault-holdings.js";

type ActiveThesesRequest = FastifyRequest<{ Params: { address: string } }>;

export async function getActiveTheses(
  request: ActiveThesesRequest,
  reply: FastifyReply,
): Promise<ApiResponse<ActiveThesisItem[]> | ApiResponse<never>> {
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
    const address = paramResult.data.address;
    const connection = getConnection(env.SOLANA_RPC_URL);

    const [walletBalances, vaults] = await Promise.all([
      getWalletBalances(connection, address),
      vaultRepo.findAllActiveVaults(),
    ]);

    const vaultByMint = new Map(
      vaults
        .filter((v) => v.shareToken?.mint)
        .map((v) => [v.shareToken!.mint, v]),
    );

    // Filter tokens that match a vault mint
    const vaultTokens = walletBalances.tokens.filter((t) =>
      vaultByMint.has(t.mint),
    );

    if (vaultTokens.length === 0) {
      return { success: true, data: [] } satisfies ApiResponse<ActiveThesisItem[]>;
    }

    // Fetch share prices, portfolio snapshots, and vault performance in parallel
    const vaultMints = vaultTokens.map((t) => t.mint);
    const [perfMap, ...snapshotsAndPrices] = await Promise.all([
      tokenPriceRepo.getVaultPerformanceByMints(vaultMints),
      ...vaultTokens.map(async (token) => {
        const vault = vaultByMint.get(token.mint)!;
        const [snapshot, sharePrice] = await Promise.all([
          portfolioRepo.findLatestSnapshot(vault.quantId),
          getSharePrice(new PublicKey(vault.statePda)).catch(() => null),
        ]);
        return { vault, token, snapshot, sharePrice };
      }),
    ]);

    const items: ActiveThesisItem[] = snapshotsAndPrices.map(
      ({ vault, token, snapshot, sharePrice }) => {
        const price = sharePrice ?? 0;
        const valueUsd = token.uiAmount * price;
        const pnlPercent = perfMap.get(token.mint) ?? 0;
        const entryValue =
          pnlPercent !== 0
            ? valueUsd / (1 + pnlPercent / 100)
            : valueUsd;
        const pnlAmount = valueUsd - entryValue;

        const allocations = snapshot?.allocations;
        const assetCount = Array.isArray(allocations)
          ? allocations.length
          : 0;

        return {
          vaultId: vault.id,
          name: vault.vaultName,
          quantUsername: vault.quant?.user?.twitterUsername ?? null,
          assetCount,
          shares: token.uiAmount,
          sharePrice: price,
          valueUsd,
          pnlAmount: Math.round(pnlAmount * 100) / 100,
          pnlPercent: Math.round(pnlPercent * 10) / 10,
        };
      },
    );

    return { success: true, data: items } satisfies ApiResponse<ActiveThesisItem[]>;
  } catch (err) {
    logger.error({ err }, "Failed to fetch active theses");
    return reply.status(502).send({
      success: false,
      error: "Failed to fetch active theses",
    } satisfies ApiResponse<never>);
  }
}
