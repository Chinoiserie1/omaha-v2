import { prisma } from "@repo/database";
import { PublicKey } from "@solana/web3.js";
import { getWalletBalances, getConnection } from "@repo/solana";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import * as tokenPriceRepo from "../store/token-price.repository.js";
import * as vaultRepo from "../store/vault.repository.js";
import * as snapshotRepo from "../store/portfolio-snapshot.repository.js";
import { getSharePrice } from "../solana/vault-holdings.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function snapshotPortfolios(): Promise<void> {
  if (!env.SOLANA_RPC_URL) {
    logger.warn("SOLANA_RPC_URL not configured — skipping portfolio snapshots");
    return;
  }

  const users = await prisma.user.findMany({
    where: { walletAddress: { not: null } },
    select: { walletAddress: true },
  });

  if (users.length === 0) {
    logger.debug("No users with wallet addresses — skipping snapshots");
    return;
  }

  const connection = getConnection(env.SOLANA_RPC_URL);
  const [priceMap, vaults] = await Promise.all([
    tokenPriceRepo.getLatestPriceMap(),
    vaultRepo.findAllActiveVaults(),
  ]);

  const vaultByMint = new Map(
    vaults
      .filter((v) => v.shareMint)
      .map((v) => [v.shareMint!, v]),
  );

  const results = await Promise.allSettled(
    users.map(async (user) => {
      const address = user.walletAddress!;
      const walletBalances = await getWalletBalances(connection, address);

      const holdings: {
        mint: string;
        symbol: string;
        amount: number;
        usdPrice: number;
        valueUsd: number;
      }[] = [];

      // SOL balance
      const solPrice = priceMap.get(SOL_MINT) ?? 0;
      if (walletBalances.sol > 0) {
        holdings.push({
          mint: SOL_MINT,
          symbol: "SOL",
          amount: walletBalances.sol,
          usdPrice: solPrice,
          valueUsd: walletBalances.sol * solPrice,
        });
      }

      // Token + vault balances
      for (const token of walletBalances.tokens) {
        const vault = vaultByMint.get(token.mint);

        if (vault) {
          let sharePrice = 0;
          try {
            const statePda = new PublicKey(vault.statePda);
            sharePrice = (await getSharePrice(statePda)) ?? 0;
          } catch {
            logger.debug({ vaultId: vault.id }, "Could not fetch share price for snapshot");
          }

          holdings.push({
            mint: token.mint,
            symbol: vault.vaultSymbol,
            amount: token.uiAmount,
            usdPrice: sharePrice,
            valueUsd: token.uiAmount * sharePrice,
          });
        } else {
          const usdPrice = priceMap.get(token.mint) ?? 0;
          const tokenRecord = await tokenPriceRepo.findTokenByMint(token.mint);

          holdings.push({
            mint: token.mint,
            symbol: tokenRecord?.symbol ?? token.mint.slice(0, 6),
            amount: token.uiAmount,
            usdPrice,
            valueUsd: token.uiAmount * usdPrice,
          });
        }
      }

      const totalValueUsd = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
      await snapshotRepo.createSnapshot(address, totalValueUsd, holdings);

      logger.debug(
        { address, totalValueUsd, holdingCount: holdings.length },
        "Portfolio snapshot created",
      );
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    logger.warn(
      { total: users.length, failed: failed.length },
      "Some portfolio snapshots failed",
    );
  } else {
    logger.info(
      { total: users.length },
      "All portfolio snapshots completed",
    );
  }
}
