import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey } from "@solana/web3.js";
import {
  walletAddressSchema,
  type ApiResponse,
  type WalletPortfolio,
  type PortfolioItem,
} from "@repo/shared";
import { getWalletBalances, getConnection } from "@repo/solana";
import { env } from "../../../utils/env.js";
import { logger } from "../../../utils/logger.js";
import * as tokenPriceRepo from "../../../store/token-price.repository.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import { getSharePrice } from "../../../solana/vault-holdings.js";

type PortfolioRequest = FastifyRequest<{ Params: { address: string } }>;

const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function getPortfolio(
  request: PortfolioRequest,
  reply: FastifyReply,
): Promise<ApiResponse<WalletPortfolio> | ApiResponse<never>> {
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

    // Fetch on-chain balances and DB prices in parallel
    const [walletBalances, priceMap] = await Promise.all([
      getWalletBalances(connection, address),
      tokenPriceRepo.getLatestPriceMap(),
    ]);

    const items: PortfolioItem[] = [];

    // SOL balance
    const solPrice = priceMap.get(SOL_MINT) ?? 0;
    if (walletBalances.sol > 0) {
      items.push({
        type: "token",
        name: "Solana",
        symbol: "SOL",
        mint: SOL_MINT,
        amount: walletBalances.sol,
        decimals: 9,
        usdPrice: solPrice,
        valueUsd: walletBalances.sol * solPrice,
      });
    }

    // Build a set of vault mint addresses for quick lookup
    const vaults = await vaultRepo.findAllActiveVaults();
    const vaultByMint = new Map(
      vaults
        .filter((v) => v.mintAddress)
        .map((v) => [v.mintAddress!, v]),
    );

    // Token balances
    for (const token of walletBalances.tokens) {
      const vault = vaultByMint.get(token.mint);

      if (vault) {
        // This is a vault share token — compute vault value
        let sharePrice = 0;
        try {
          const statePda = new PublicKey(vault.statePda);
          sharePrice = (await getSharePrice(statePda)) ?? 0;
        } catch {
          logger.debug({ vaultId: vault.id }, "Could not fetch share price");
        }

        items.push({
          type: "vault",
          name: vault.vaultName,
          vaultId: vault.id,
          shares: token.uiAmount,
          sharePrice,
          valueUsd: token.uiAmount * sharePrice,
        });
      } else {
        // Regular token
        const usdPrice = priceMap.get(token.mint) ?? 0;
        const tokenRecord = await tokenPriceRepo.findTokenByMint(token.mint);

        items.push({
          type: "token",
          name: tokenRecord?.name ?? token.mint.slice(0, 8),
          symbol: tokenRecord?.symbol ?? token.mint.slice(0, 6),
          mint: token.mint,
          amount: token.uiAmount,
          decimals: token.decimals,
          programId: token.programId,
          usdPrice,
          valueUsd: token.uiAmount * usdPrice,
        });
      }
    }

    const totalUsd = items.reduce((sum, item) => sum + item.valueUsd, 0);

    return {
      success: true,
      data: { totalUsd, items },
    } satisfies ApiResponse<WalletPortfolio>;
  } catch (err) {
    logger.error({ err }, "Failed to build wallet portfolio");
    return reply.status(502).send({
      success: false,
      error: "Failed to fetch wallet portfolio",
    } satisfies ApiResponse<never>);
  }
}
