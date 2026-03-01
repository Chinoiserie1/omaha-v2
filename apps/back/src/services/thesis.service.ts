import type { Prisma } from "@repo/database";
import { logger } from "../utils/logger.js";
import { llmComplete } from "../utils/llm.js";
import { extractJson } from "../utils/extract-json.js";
import {
  PortfolioOutputSchema,
  buildThesisSystemPrompt,
  type Allocation,
} from "@repo/shared";
import * as portfolioRepo from "../store/portfolio.repository.js";
import * as classificationRepo from "../store/classification.repository.js";
import { findActiveKols } from "../store/kol.repository.js";
import { getTradeableAssetsMap } from "./jupiter.service.js";
import { getCuratedAssetSymbols } from "../data/curated-assets.js";
import { classifyUnclassifiedTweets } from "./classifier.service.js";
import { computeLatestPeriod } from "./backtest.service.js";
import { computeTweetImpacts } from "./tweet-impact.service.js";

export function applyConvictionDecay(
  allocations: Allocation[],
  now: Date
): Allocation[] {
  return allocations.map((alloc) => {
    if (alloc.asset === "USDC") return alloc;

    const lastSignal = new Date(alloc.lastSignal);
    const daysSince =
      (now.getTime() - lastSignal.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince > 90) {
      logger.info(
        { asset: alloc.asset, daysSince: Math.round(daysSince) },
        "Conviction decayed to stale (>90d)"
      );
      return { ...alloc, conviction: "stale" as const };
    }
    if (daysSince > 30) {
      if (alloc.conviction === "high") {
        logger.info(
          { asset: alloc.asset, daysSince: Math.round(daysSince) },
          "Conviction decayed high → medium (>30d)"
        );
        return { ...alloc, conviction: "medium" as const };
      }
      if (alloc.conviction === "medium") {
        logger.info(
          { asset: alloc.asset, daysSince: Math.round(daysSince) },
          "Conviction decayed medium → low (>30d)"
        );
        return { ...alloc, conviction: "low" as const };
      }
    }

    return alloc;
  });
}

function formatClassificationsWithThreads(
  classifications: Array<{
    category: string;
    sentiment: string | null;
    conviction: string | null;
    tweet: { postedAt: Date; fullText: string; conversationId: string | null };
  }>
): string {
  type C = (typeof classifications)[number];
  const threadGroups = new Map<string, C[]>();
  const entries: { timestamp: Date; line: string }[] = [];

  for (const c of classifications) {
    if (c.tweet.conversationId) {
      const group = threadGroups.get(c.tweet.conversationId);
      if (group) {
        group.push(c);
      } else {
        threadGroups.set(c.tweet.conversationId, [c]);
      }
    } else {
      entries.push({
        timestamp: c.tweet.postedAt,
        line: `[${c.tweet.postedAt.toISOString()}] (${c.category}, ${c.sentiment}, ${c.conviction}) ${c.tweet.fullText}`,
      });
    }
  }

  for (const [, group] of threadGroups) {
    const starter = group[0]!;
    const threadText =
      group.length > 1
        ? `[THREAD - ${group.length} tweets]\n${group.map((c) => c.tweet.fullText).join("\n---\n")}`
        : starter.tweet.fullText;

    entries.push({
      timestamp: starter.tweet.postedAt,
      line: `[${starter.tweet.postedAt.toISOString()}] (${starter.category}, ${starter.sentiment}, ${starter.conviction}) ${threadText}`,
    });
  }

  entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return entries.map((e) => e.line).join("\n\n");
}

export async function synthesizeThesis(kolId: string): Promise<boolean> {
  const latestSnapshot = await portfolioRepo.findLatestSnapshot(kolId);
  const tradeableAssets = await getTradeableAssetsMap();

  logger.info(
    { kolId, tradeableAssetsCount: tradeableAssets.size, hasExistingSnapshot: !!latestSnapshot },
    "Starting thesis synthesis"
  );

  let userContent: string;
  let sourceTweetIds: string[];

  if (!latestSnapshot) {
    logger.info({ kolId }, "Cold start — no previous snapshot, building thesis from scratch");

    const allRelevant =
      await classificationRepo.findRelevantClassificationsSince(
        kolId,
        new Date(0)
      );

    if (allRelevant.length === 0) {
      logger.info({ kolId }, "No relevant tweets for cold start, skipping");
      return false;
    }

    sourceTweetIds = allRelevant.map((c) => c.tweetId);

    logger.info(
      { kolId, relevantTweets: allRelevant.length },
      "Found relevant tweets for cold start"
    );

    const tweetsFormatted = formatClassificationsWithThreads(allRelevant);

    userContent = `ALL RELEVANT TWEETS (oldest to newest):\n${tweetsFormatted}\n\nBuild their current investment thesis from scratch.`;
  } else {
    logger.info(
      { kolId, lastSnapshotAt: latestSnapshot.createdAt.toISOString() },
      "Updating existing thesis"
    );

    const newRelevant =
      await classificationRepo.findRelevantClassificationsSince(
        kolId,
        latestSnapshot.createdAt
      );

    if (newRelevant.length === 0) {
      logger.info({ kolId }, "No new relevant tweets since last snapshot, skipping");
      return false;
    }

    sourceTweetIds = newRelevant.map((c) => c.tweetId);

    logger.info(
      { kolId, newRelevantTweets: newRelevant.length },
      "Found new relevant tweets since last snapshot"
    );

    const currentState = JSON.stringify({
      thesisSummary: latestSnapshot.thesisSummary,
      allocations: latestSnapshot.allocations,
    });

    const tweetsFormatted = formatClassificationsWithThreads(newRelevant);

    userContent = `CURRENT THESIS STATE (carry forward unless contradicted):\n${currentState}\n\nNEW RELEVANT TWEETS (since last update, chronological):\n${tweetsFormatted}`;
  }

  const availableSymbols = getCuratedAssetSymbols();
  const thesisPrompt = buildThesisSystemPrompt(availableSymbols);

  logger.info({ kolId, availableAssetsCount: availableSymbols.length }, "Sending thesis prompt to LLM");

  let rawResponse: string;
  try {
    rawResponse = await llmComplete(thesisPrompt, userContent);
  } catch (err) {
    logger.error({ err, kolId }, "LLM call failed for thesis synthesis");
    return false;
  }

  logger.info({ kolId, responseLength: rawResponse.length }, "LLM response received");

  let parsed: unknown;
  try {
    parsed = extractJson(rawResponse);
  } catch {
    logger.error({ kolId, rawResponse }, "Failed to parse thesis JSON");
    return false;
  }

  const result = PortfolioOutputSchema.safeParse(parsed);
  if (!result.success) {
    logger.error(
      { kolId, errors: result.error.issues },
      "Thesis response failed schema validation"
    );
    return false;
  }

  const portfolio = result.data;

  logger.info(
    { kolId, thesisSummary: portfolio.thesisSummary },
    "Thesis summary"
  );

  // Validate allocations sum roughly to 100%
  const totalPct = portfolio.allocations.reduce(
    (sum, a) => sum + a.percentage,
    0
  );
  logger.info({ kolId, totalPct }, "Allocation total percentage");

  if (totalPct < 95 || totalPct > 105) {
    logger.error(
      { kolId, totalPct },
      "Allocation percentages don't sum to ~100%, rejecting"
    );
    return false;
  }

  // Log each allocation
  for (const alloc of portfolio.allocations) {
    logger.info(
      {
        kolId,
        asset: alloc.asset,
        percentage: alloc.percentage,
        conviction: alloc.conviction,
        reasoning: alloc.reasoning,
        since: alloc.since,
        lastSignal: alloc.lastSignal,
      },
      "Allocation"
    );
  }

  // Resolve mints from tradeable assets map
  for (const alloc of portfolio.allocations) {
    if (alloc.asset === "USDC") continue;
    const tradeableInfo = tradeableAssets.get(alloc.asset);
    if (!tradeableInfo) {
      logger.warn(
        { kolId, asset: alloc.asset },
        "Asset not in tradeable assets, skipping"
      );
      continue;
    }
    alloc.mint = tradeableInfo.mint;
  }

  // Apply conviction decay
  const decayedAllocations = applyConvictionDecay(
    portfolio.allocations as unknown as Allocation[],
    new Date()
  );

  // Log changes
  if (portfolio.changes.length > 0) {
    for (const change of portfolio.changes) {
      logger.info({ kolId, change }, "Portfolio change");
    }
  } else {
    logger.info({ kolId }, "No portfolio changes");
  }

  const savedSnapshot = await portfolioRepo.createSnapshot({
    kolId,
    thesisSummary: portfolio.thesisSummary,
    allocations: decayedAllocations as unknown as Prisma.InputJsonValue,
    changes: portfolio.changes,
    sourceTweetIds,
  });

  logger.info(
    { kolId, allocations: decayedAllocations.length, changes: portfolio.changes.length },
    "Portfolio snapshot saved"
  );

  // Compute tweet impact scores (non-fatal)
  try {
    const oldAllocations = latestSnapshot
      ? (latestSnapshot.allocations as unknown as Allocation[])
      : null;
    await computeTweetImpacts({
      kolId,
      snapshotId: savedSnapshot.id,
      sourceTweetIds,
      oldAllocations,
      newAllocations: decayedAllocations as unknown as Allocation[],
    });
  } catch (err) {
    logger.warn({ err, kolId }, "Failed to compute tweet impacts (non-fatal)");
  }

  // Compute backtest performance for this new period (non-fatal)
  try {
    await computeLatestPeriod(kolId);
  } catch (err) {
    logger.warn({ err, kolId }, "Failed to compute period performance (non-fatal)");
  }

  return true;
}

export async function synthesizeAllKols(): Promise<void> {
  const kols = await findActiveKols();
  logger.info({ count: kols.length }, "Running algo for all active KOLs");

  let processed = 0;
  let skipped = 0;
  let updated = 0;

  for (const kol of kols) {
    if (!kol.hasTwitter) {
      logger.info({ username: kol.username }, "Skipping non-Twitter KOL for algo");
      continue;
    }

    if (!kol.algoEnabled) {
      logger.info({ username: kol.username }, "Algo disabled for KOL, skipping");
      continue;
    }

    logger.info(
      { kolId: kol.id, username: kol.username, progress: `${processed + 1}/${kols.length}` },
      "Processing KOL"
    );

    try {
      const classified = await classifyUnclassifiedTweets(kol.id);
      logger.info({ kolId: kol.id, username: kol.username, classified }, "Classification done");

      const didUpdate = await synthesizeThesis(kol.id);
      if (didUpdate) {
        updated++;
      } else {
        skipped++;
      }
      logger.info(
        { kolId: kol.id, username: kol.username, didUpdate },
        "Thesis synthesis done"
      );
    } catch (err) {
      logger.error(
        { err, kolId: kol.id, username: kol.username },
        "Algo failed for KOL"
      );
    }

    processed++;
  }

  logger.info(
    { total: kols.length, processed, updated, skipped },
    "Algo run summary"
  );
}
