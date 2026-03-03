import type { PortfolioSnapshot, Prisma } from "@repo/database";
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

// ---------------------------------------------------------------------------
// Single snapshot synthesis (extracted for reuse by both incremental & retroactive paths)
// ---------------------------------------------------------------------------

interface SingleSnapshotInput {
  kolId: string;
  userContent: string;
  sourceTweetIds: string[];
  previousSnapshot: PortfolioSnapshot | null;
  createdAt?: Date;
  decayReferenceDate?: Date;
}

async function synthesizeSingleSnapshot(
  input: SingleSnapshotInput,
  tradeableAssets: Map<string, { mint: string; decimals: number }>
): Promise<{ snapshot: PortfolioSnapshot; allocations: Allocation[] } | null> {
  const { kolId, userContent, sourceTweetIds, previousSnapshot, createdAt, decayReferenceDate } = input;

  const availableSymbols = getCuratedAssetSymbols();
  const thesisPrompt = buildThesisSystemPrompt(availableSymbols);

  logger.info({ kolId, availableAssetsCount: availableSymbols.length }, "Sending thesis prompt to LLM");

  let rawResponse: string;
  try {
    rawResponse = await llmComplete(thesisPrompt, userContent);
  } catch (err) {
    logger.error({ err, kolId }, "LLM call failed for thesis synthesis");
    return null;
  }

  logger.info({ kolId, responseLength: rawResponse.length }, "LLM response received");

  let parsed: unknown;
  try {
    parsed = extractJson(rawResponse);
  } catch {
    logger.error({ kolId, rawResponse }, "Failed to parse thesis JSON");
    return null;
  }

  const result = PortfolioOutputSchema.safeParse(parsed);
  if (!result.success) {
    logger.error(
      { kolId, errors: result.error.issues },
      "Thesis response failed schema validation"
    );
    return null;
  }

  const portfolio = result.data;

  logger.info({ kolId, thesisSummary: portfolio.thesisSummary }, "Thesis summary");

  // Validate allocations sum roughly to 100%
  const totalPct = portfolio.allocations.reduce((sum, a) => sum + a.percentage, 0);
  logger.info({ kolId, totalPct }, "Allocation total percentage");

  if (totalPct < 95 || totalPct > 105) {
    logger.error({ kolId, totalPct }, "Allocation percentages don't sum to ~100%, rejecting");
    return null;
  }

  for (const alloc of portfolio.allocations) {
    logger.info(
      { kolId, asset: alloc.asset, percentage: alloc.percentage, conviction: alloc.conviction, reasoning: alloc.reasoning, since: alloc.since, lastSignal: alloc.lastSignal },
      "Allocation"
    );
  }

  // Resolve mints from tradeable assets map
  for (const alloc of portfolio.allocations) {
    if (alloc.asset === "USDC") continue;
    const tradeableInfo = tradeableAssets.get(alloc.asset);
    if (!tradeableInfo) {
      logger.warn({ kolId, asset: alloc.asset }, "Asset not in tradeable assets, skipping");
      continue;
    }
    alloc.mint = tradeableInfo.mint;
  }

  // Apply conviction decay
  const decayedAllocations = applyConvictionDecay(
    portfolio.allocations as unknown as Allocation[],
    decayReferenceDate ?? new Date()
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
    ...(createdAt ? { createdAt } : {}),
  });

  logger.info(
    { kolId, allocations: decayedAllocations.length, changes: portfolio.changes.length, createdAt: createdAt?.toISOString() },
    "Portfolio snapshot saved"
  );

  // Compute tweet impact scores (non-fatal)
  try {
    const oldAllocations = previousSnapshot
      ? (previousSnapshot.allocations as unknown as Allocation[])
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

  return { snapshot: savedSnapshot, allocations: decayedAllocations };
}

// ---------------------------------------------------------------------------
// Weekly window generation for retroactive snapshots
// ---------------------------------------------------------------------------

interface TimeWindow {
  startDate: Date;
  endDate: Date;
}

export function generateWeeklyWindows(earliest: Date, latest: Date): TimeWindow[] {
  const windows: TimeWindow[] = [];

  // Find Monday 00:00:00 UTC of the week containing `earliest`
  const day = earliest.getUTCDay(); // 0=Sun, 1=Mon...
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const firstMonday = new Date(Date.UTC(
    earliest.getUTCFullYear(),
    earliest.getUTCMonth(),
    earliest.getUTCDate() + mondayOffset
  ));

  let windowStart = firstMonday;

  while (windowStart.getTime() <= latest.getTime()) {
    // Sunday 23:59:59.999 UTC of this week
    const sundayEnd = new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

    // Cap last window at `latest`
    const windowEnd = sundayEnd.getTime() > latest.getTime() ? latest : sundayEnd;

    windows.push({ startDate: new Date(windowStart), endDate: windowEnd });

    // Next Monday
    windowStart = new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return windows;
}

// ---------------------------------------------------------------------------
// Retroactive snapshot generation (cold start replacement)
// ---------------------------------------------------------------------------

type ClassificationWithTweet = Awaited<
  ReturnType<typeof classificationRepo.findRelevantClassificationsSince>
>[number];

async function generateRetroactiveSnapshots(
  kolId: string,
  allRelevant: ClassificationWithTweet[]
): Promise<boolean> {
  const tradeableAssets = await getTradeableAssetsMap();

  // Sort by tweet posted date (not classifiedAt which is bulk classification time)
  const sorted = [...allRelevant].sort(
    (a, b) => a.tweet.postedAt.getTime() - b.tweet.postedAt.getTime()
  );

  const earliest = sorted[0]!.tweet.postedAt;
  const latest = sorted[sorted.length - 1]!.tweet.postedAt;
  const windows = generateWeeklyWindows(earliest, latest);

  logger.info(
    { kolId, totalTweets: sorted.length, windows: windows.length, earliest: earliest.toISOString(), latest: latest.toISOString() },
    "Generating retroactive weekly snapshots"
  );

  let previousSnapshot: PortfolioSnapshot | null = null;
  let cumulativeTweets: ClassificationWithTweet[] = [];
  let generatedCount = 0;

  for (const window of windows) {
    // Collect tweets in this window
    const windowTweets = sorted.filter(
      (c) => c.tweet.postedAt >= window.startDate && c.tweet.postedAt <= window.endDate
    );

    if (windowTweets.length === 0) continue;

    cumulativeTweets = [...cumulativeTweets, ...windowTweets];
    const sourceTweetIds = windowTweets.map((c) => c.tweetId);

    let userContent: string;

    if (!previousSnapshot) {
      // First window: cold start from all tweets up to this point
      const tweetsFormatted = formatClassificationsWithThreads(cumulativeTweets);
      userContent = `ALL RELEVANT TWEETS (oldest to newest):\n${tweetsFormatted}\n\nBuild their current investment thesis from scratch.`;
    } else {
      // Subsequent windows: incremental update
      const currentState = JSON.stringify({
        thesisSummary: previousSnapshot.thesisSummary,
        allocations: previousSnapshot.allocations,
      });
      const tweetsFormatted = formatClassificationsWithThreads(windowTweets);
      userContent = `CURRENT THESIS STATE (carry forward unless contradicted):\n${currentState}\n\nNEW RELEVANT TWEETS (since last update, chronological):\n${tweetsFormatted}`;
    }

    logger.info(
      { kolId, windowStart: window.startDate.toISOString(), windowEnd: window.endDate.toISOString(), tweetsInWindow: windowTweets.length },
      "Processing retroactive window"
    );

    const result = await synthesizeSingleSnapshot(
      {
        kolId,
        userContent,
        sourceTweetIds,
        previousSnapshot,
        createdAt: window.endDate,
        decayReferenceDate: window.endDate,
      },
      tradeableAssets
    );

    if (result) {
      previousSnapshot = result.snapshot;
      generatedCount++;
      logger.info(
        { kolId, generatedCount, windowEnd: window.endDate.toISOString() },
        "Generated retroactive snapshot"
      );
    } else {
      logger.warn(
        { kolId, windowEnd: window.endDate.toISOString() },
        "Failed to generate retroactive snapshot for window, continuing"
      );
    }
  }

  logger.info({ kolId, generatedCount, totalWindows: windows.length }, "Retroactive snapshot generation complete");
  return generatedCount > 0;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function synthesizeThesis(kolId: string): Promise<boolean> {
  const tradeableAssets = await getTradeableAssetsMap();

  logger.info(
    { kolId, tradeableAssetsCount: tradeableAssets.size },
    "Starting thesis synthesis"
  );

  // --- Retroactive backfill: check for tweets older than earliest snapshot ---
  const earliestSnapshot = await portfolioRepo.findEarliestSnapshot(kolId);
  const allRelevant = await classificationRepo.findRelevantClassificationsSince(kolId, new Date(0));

  if (allRelevant.length > 0) {
    const oldestTweetDate = allRelevant.reduce(
      (min, c) => (c.tweet.postedAt < min ? c.tweet.postedAt : min),
      allRelevant[0]!.tweet.postedAt
    );

    if (!earliestSnapshot) {
      // Cold start: no snapshots at all → full retroactive generation
      logger.info({ kolId }, "Cold start — generating retroactive weekly snapshots");
      return generateRetroactiveSnapshots(kolId, allRelevant);
    }

    if (oldestTweetDate < earliestSnapshot.createdAt) {
      // Gap detected: tweets exist before earliest snapshot → backfill the gap
      const tweetsBeforeEarliest = allRelevant.filter(
        (c) => c.tweet.postedAt < earliestSnapshot.createdAt
      );
      logger.info(
        {
          kolId,
          gap: `${oldestTweetDate.toISOString()} → ${earliestSnapshot.createdAt.toISOString()}`,
          tweetsInGap: tweetsBeforeEarliest.length,
        },
        "Gap detected — backfilling retroactive snapshots before earliest existing snapshot"
      );
      await generateRetroactiveSnapshots(kolId, tweetsBeforeEarliest);
      // Fall through to incremental path for new tweets
    }
  }

  // --- Incremental update ---
  // Re-fetch latestSnapshot since retroactive backfill may have created new ones
  const currentLatest = await portfolioRepo.findLatestSnapshot(kolId);
  if (!currentLatest) {
    logger.info({ kolId }, "No snapshots and no relevant tweets, skipping");
    return false;
  }

  const newRelevant = await classificationRepo.findRelevantClassificationsSince(kolId, currentLatest.createdAt);
  if (newRelevant.length === 0) {
    logger.info({ kolId }, "No new relevant tweets since last snapshot, skipping");
    return false;
  }

  const sourceTweetIds = newRelevant.map((c) => c.tweetId);

  logger.info({ kolId, newRelevantTweets: newRelevant.length }, "Found new relevant tweets since last snapshot");

  const currentState = JSON.stringify({
    thesisSummary: currentLatest.thesisSummary,
    allocations: currentLatest.allocations,
  });
  const tweetsFormatted = formatClassificationsWithThreads(newRelevant);
  const userContent = `CURRENT THESIS STATE (carry forward unless contradicted):\n${currentState}\n\nNEW RELEVANT TWEETS (since last update, chronological):\n${tweetsFormatted}`;

  const result = await synthesizeSingleSnapshot(
    { kolId, userContent, sourceTweetIds, previousSnapshot: currentLatest },
    tradeableAssets
  );

  if (!result) return false;

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
