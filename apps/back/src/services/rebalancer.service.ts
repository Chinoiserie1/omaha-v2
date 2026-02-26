import { PublicKey } from "@solana/web3.js";
import { logger } from "../utils/logger.js";
import { env } from "../utils/env.js";
import { USDC_MINT } from "../solana/config.js";
import { getVaultHoldings } from "../solana/vault-holdings.js";
import { allowlistTokensOnVault } from "../solana/vault-setup.js";
import { executeJupiterSwap } from "./jupiter-swap.service.js";
import { getTradeableAssetsMap } from "./jupiter.service.js";
import * as kolVaultRepo from "../store/kol-vault.repository.js";
import * as rebalanceRepo from "../store/rebalance.repository.js";
import * as portfolioRepo from "../store/portfolio.repository.js";
import * as holdingsRepo from "../store/holdings.repository.js";
import type { Allocation, VaultHolding, VaultHoldingWithPct, SwapDelta, RebalanceStatus } from "@repo/shared";
import type { Prisma } from "@repo/database";

const USDC_MINT_STR = USDC_MINT.toBase58();

// ── Delta Computation ──────────────────────────────────────────

export function computeSwapDeltas(
  targetAllocations: Allocation[],
  currentHoldings: VaultHolding[],
  totalEquityUsd: number
): { sells: SwapDelta[]; buys: SwapDelta[] } {
  if (totalEquityUsd <= 0) return { sells: [], buys: [] };

  // Build current allocation map: mint → { pct, price, uiAmount, symbol }
  const currentMap = new Map<
    string,
    { pct: number; price: number; uiAmount: number; symbol: string }
  >();
  for (const h of currentHoldings) {
    currentMap.set(h.mint, {
      pct: (h.valueUsd / totalEquityUsd) * 100,
      price: h.price,
      uiAmount: h.uiAmount,
      symbol: h.symbol,
    });
  }

  const sells: SwapDelta[] = [];
  const buys: SwapDelta[] = [];

  for (const target of targetAllocations) {
    // Skip USDC — it's the residual/base asset
    if (!target.mint || target.asset === "USDC") continue;

    const current = currentMap.get(target.mint);
    const currentPct = current?.pct ?? 0;
    const targetPct = target.percentage;
    const deltaPct = targetPct - currentPct;
    const deltaUsd = (deltaPct / 100) * totalEquityUsd;

    // Skip small deltas
    if (Math.abs(deltaPct) < 1 || Math.abs(deltaUsd) < env.MIN_SWAP_USD) {
      continue;
    }

    const delta: SwapDelta = {
      asset: target.asset,
      mint: target.mint,
      direction: deltaUsd < 0 ? "sell" : "buy",
      currentPct,
      targetPct,
      deltaPct: Math.abs(deltaPct),
      deltaUsd: Math.abs(deltaUsd),
    };

    if (delta.direction === "sell") {
      sells.push(delta);
    } else {
      buys.push(delta);
    }
  }

  // Check for current holdings not in target (should be sold to 0%)
  for (const [mint, current] of currentMap) {
    if (mint === USDC_MINT_STR) continue;
    const inTarget = targetAllocations.some((t) => t.mint === mint);
    if (!inTarget && current.pct > 1 && current.pct * totalEquityUsd / 100 >= env.MIN_SWAP_USD) {
      sells.push({
        asset: current.symbol,
        mint,
        direction: "sell",
        currentPct: current.pct,
        targetPct: 0,
        deltaPct: current.pct,
        deltaUsd: (current.pct / 100) * totalEquityUsd,
      });
    }
  }

  // Sort: largest deltas first
  sells.sort((a, b) => b.deltaUsd - a.deltaUsd);
  buys.sort((a, b) => b.deltaUsd - a.deltaUsd);

  return { sells, buys };
}

// ── Safety Checks ──────────────────────────────────────────────

function validateSwapSize(delta: SwapDelta, totalEquityUsd: number): void {
  const maxUsd = (env.MAX_SWAP_EQUITY_PCT / 100) * totalEquityUsd;
  if (delta.deltaUsd > maxUsd) {
    throw new Error(
      `Swap too large: $${delta.deltaUsd.toFixed(2)} exceeds ${env.MAX_SWAP_EQUITY_PCT}% of vault equity ($${maxUsd.toFixed(2)})`
    );
  }
}

function isSnapshotFresh(createdAt: Date): boolean {
  const ageMs = Date.now() - createdAt.getTime();
  const maxMs = env.SNAPSHOT_STALENESS_H * 60 * 60 * 1000;
  return ageMs <= maxMs;
}

async function hasActiveRebalance(kolVaultId: string): Promise<boolean> {
  const latest = await rebalanceRepo.findLatestByKolVault(kolVaultId);
  return latest?.status === "EXECUTING";
}

// ── Single Vault Rebalance ─────────────────────────────────────

export async function rebalanceKolVault(
  kolId: string
): Promise<string | null> {
  // 1. Look up KolVault
  const kolVault = await kolVaultRepo.findByKolId(kolId);
  if (!kolVault || !kolVault.isActive) {
    logger.debug({ kolId }, "No active vault for KOL, skipping");
    return null;
  }
  if (!kolVault.jupiterEnabled) {
    logger.warn({ kolId }, "Jupiter not enabled on vault, skipping");
    return null;
  }

  const statePda = new PublicKey(kolVault.statePda);

  // 2. Get latest PortfolioSnapshot
  const snapshot = await portfolioRepo.findLatestSnapshot(kolId);
  if (!snapshot) {
    logger.debug({ kolId }, "No portfolio snapshot found, skipping");
    return null;
  }

  // 3. Check staleness
  if (!isSnapshotFresh(snapshot.createdAt)) {
    logger.warn(
      { kolId, snapshotAge: snapshot.createdAt },
      "Portfolio snapshot too stale, skipping"
    );
    return null;
  }

  // 4. Prevent concurrent rebalances
  if (await hasActiveRebalance(kolVault.id)) {
    logger.warn({ kolId }, "Rebalance already in progress, skipping");
    return null;
  }

  // 5. Get on-chain holdings
  const { holdings, totalEquityUsd } = await getVaultHoldings(statePda);

  if (totalEquityUsd <= 0) {
    logger.debug({ kolId }, "Vault has no equity, skipping");
    return null;
  }

  // 6. Resolve mints for allocations from TradeableAsset DB
  const assetsMap = await getTradeableAssetsMap();
  const snapshotAllocs = snapshot.allocations as unknown as Allocation[];
  const allocations: Allocation[] = snapshotAllocs.map((a) => ({
    asset: a.asset,
    percentage: a.percentage,
    conviction: a.conviction,
    reasoning: a.reasoning,
    since: a.since,
    lastSignal: a.lastSignal,
    mint: a.mint ?? assetsMap.get(a.asset)?.mint ?? "",
  }));

  // 7. Compute deltas
  const { sells, buys } = computeSwapDeltas(
    allocations,
    holdings,
    totalEquityUsd
  );

  if (sells.length === 0 && buys.length === 0) {
    logger.info({ kolId }, "Vault already balanced, no swaps needed");
    return null;
  }

  const isDryRun = env.REBALANCE_DRY_RUN || kolVault.dryRun;
  const status: RebalanceStatus = isDryRun ? "DRY_RUN" : "EXECUTING";

  // 8. Create RebalanceEvent
  const event = await rebalanceRepo.createEvent({
    kolVaultId: kolVault.id,
    snapshotId: snapshot.id,
    status,
    vaultEquityUsd: totalEquityUsd,
  });

  logger.info(
    {
      kolId,
      status,
      sells: sells.length,
      buys: buys.length,
      totalEquityUsd,
    },
    "Rebalance plan computed"
  );

  // 9. Dry run — log plan and return
  if (isDryRun) {
    const allDeltas = [...sells, ...buys];
    logger.info(
      { deltas: allDeltas },
      "DRY RUN: Would execute these swaps"
    );
    await rebalanceRepo.completeEvent(event.id, {
      status: "DRY_RUN",
      sellCount: sells.length,
      buyCount: buys.length,
      totalSwaps: allDeltas.length,
      swapDetails: allDeltas as unknown as Prisma.InputJsonValue,
    });
    return event.id;
  }

  // 10. Allowlist all target mints on vault
  const targetMints = allocations
    .map((a) => a.mint)
    .filter((m): m is string => !!m && m !== USDC_MINT_STR);
  if (targetMints.length > 0) {
    await allowlistTokensOnVault(
      statePda,
      targetMints.map((m) => new PublicKey(m))
    );
  }

  const swapResults: SwapDelta[] = [];
  let failedCount = 0;

  // 11. Execute SELLS first (token → USDC)
  for (const sell of sells) {
    try {
      validateSwapSize(sell, totalEquityUsd);

      // Convert deltaUsd to token lamports using holdings price
      const holding = holdings.find((h) => h.mint === sell.mint);
      if (!holding || holding.price <= 0) {
        throw new Error(`No price data for ${sell.asset}`);
      }
      const tokenAmount = sell.deltaUsd / holding.price;
      const decimals = assetsMap.get(sell.asset)?.decimals ?? 9;
      const amountLamports = Math.floor(
        tokenAmount * Math.pow(10, decimals)
      ).toString();

      const txSig = await executeJupiterSwap(
        statePda,
        sell.mint,
        USDC_MINT_STR,
        amountLamports
      );
      swapResults.push({ ...sell, txSig });
      logger.info({ txSig, asset: sell.asset, deltaUsd: sell.deltaUsd }, "Sell executed");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      swapResults.push({ ...sell, error: errorMsg });
      failedCount++;
      logger.error({ asset: sell.asset, error: errorMsg }, "Sell failed");
    }
  }

  // 12. Execute BUYS (USDC → token)
  for (const buy of buys) {
    try {
      validateSwapSize(buy, totalEquityUsd);

      // Convert deltaUsd to USDC lamports (6 decimals)
      const amountLamports = Math.floor(buy.deltaUsd * 1e6).toString();

      const txSig = await executeJupiterSwap(
        statePda,
        USDC_MINT_STR,
        buy.mint,
        amountLamports
      );
      swapResults.push({ ...buy, txSig });
      logger.info({ txSig, asset: buy.asset, deltaUsd: buy.deltaUsd }, "Buy executed");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      swapResults.push({ ...buy, error: errorMsg });
      failedCount++;
      logger.error({ asset: buy.asset, error: errorMsg }, "Buy failed");
    }
  }

  // 13. Update RebalanceEvent
  const finalStatus: RebalanceStatus =
    failedCount === sells.length + buys.length
      ? "FAILED"
      : "COMPLETED";

  await rebalanceRepo.completeEvent(event.id, {
    status: finalStatus,
    sellCount: sells.length,
    buyCount: buys.length,
    totalSwaps: sells.length + buys.length,
    swapDetails: swapResults as unknown as Prisma.InputJsonValue,
    ...(failedCount > 0
      ? { errorMessage: `${failedCount}/${sells.length + buys.length} swaps failed` }
      : {}),
  });

  // 14. Update KolVault.lastRebalancedAt
  await kolVaultRepo.updateLastRebalanced(kolVault.id);

  // 15. Snapshot post-rebalance holdings
  if (finalStatus === "COMPLETED") {
    try {
      const postHoldings = await getVaultHoldings(statePda);
      const holdingsWithPct: VaultHoldingWithPct[] = postHoldings.holdings.map(
        (h) => ({
          ...h,
          percentage:
            postHoldings.totalEquityUsd > 0
              ? (h.valueUsd / postHoldings.totalEquityUsd) * 100
              : 0,
        }),
      );
      await holdingsRepo.createSnapshot({
        kolVaultId: kolVault.id,
        holdings: holdingsWithPct as unknown as Prisma.InputJsonValue,
        totalEquityUsd: postHoldings.totalEquityUsd,
      });
      logger.info({ kolId }, "Post-rebalance holdings snapshot created");
    } catch (snapErr) {
      logger.error(
        { kolId, error: snapErr instanceof Error ? snapErr.message : snapErr },
        "Failed to create post-rebalance holdings snapshot",
      );
    }
  }

  logger.info(
    {
      kolId,
      status: finalStatus,
      executed: sells.length + buys.length - failedCount,
      failed: failedCount,
    },
    "Rebalance complete"
  );

  return event.id;
}

// ── Rebalance All ──────────────────────────────────────────────

export async function rebalanceAllKolVaults(): Promise<void> {
  const vaults = await kolVaultRepo.findAllActive();

  logger.info({ count: vaults.length }, "Starting rebalance for all active vaults");

  let rebalanced = 0;
  let skipped = 0;
  let failed = 0;

  for (const vault of vaults) {
    try {
      const result = await rebalanceKolVault(vault.kolId);
      if (result) {
        rebalanced++;
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      logger.error(
        {
          kolId: vault.kolId,
          error: err instanceof Error ? err.message : err,
        },
        "Rebalance failed for vault"
      );
    }
  }

  logger.info(
    { total: vaults.length, rebalanced, skipped, failed },
    "Rebalance sweep complete"
  );
}
