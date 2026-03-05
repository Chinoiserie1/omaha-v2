import type { PortfolioSnapshot, Prisma } from "@repo/database";
import { logger } from "../utils/logger.js";
import { llmComplete } from "../utils/llm.js";
import { extractJson } from "../utils/extract-json.js";
import {
  PortfolioOutputSchema,
  buildThesisSystemPrompt,
  KolKnowledgeSchema,
  type Allocation,
  type KolKnowledge,
} from "@repo/shared";
import * as portfolioRepo from "../store/portfolio.repository.js";
import * as classificationRepo from "../store/classification.repository.js";
import { findActiveQuants, findQuantById } from "../store/quant.repository.js";
import { buildGlobalKnowledgeContext } from "../data/knowledge/index.js";
import { mergeAssetGroupAllocations } from "../data/knowledge/asset-groups.js";
import { getTradeableAssetsMap } from "./jupiter.service.js";
import { getCuratedAssetSymbols } from "../data/curated-assets.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetAliases: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, "../data/asset-aliases.json"), "utf-8"),
);

function normalizeAsset(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return assetAliases[lower] ?? raw.toUpperCase();
}
import { classifyUnclassifiedTweets } from "./classifier.service.js";
import { computeLatestPeriod } from "./backtest.service.js";
import { computeTweetImpacts } from "./tweet-impact.service.js";

export function applyConvictionDecay(
  allocations: Allocation[],
  now: Date,
): Allocation[] {
  return allocations.map((alloc) => {
    if (alloc.asset === "USDC") return alloc;

    const lastSignal = new Date(alloc.lastSignal);
    const daysSince =
      (now.getTime() - lastSignal.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince > 90) {
      logger.info(
        { asset: alloc.asset, daysSince: Math.round(daysSince) },
        "Conviction decayed to stale (>90d)",
      );
      return { ...alloc, conviction: "stale" as const };
    }
    if (daysSince > 30) {
      if (alloc.conviction === "high") {
        logger.info(
          { asset: alloc.asset, daysSince: Math.round(daysSince) },
          "Conviction decayed high → medium (>30d)",
        );
        return { ...alloc, conviction: "medium" as const };
      }
      if (alloc.conviction === "medium") {
        logger.info(
          { asset: alloc.asset, daysSince: Math.round(daysSince) },
          "Conviction decayed medium → low (>30d)",
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
  }>,
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
// KOL knowledge formatting
// ---------------------------------------------------------------------------

function formatKolKnowledge(knowledge: KolKnowledge): string {
  const parts: string[] = [];
  if (knowledge.investmentStyle) {
    parts.push(`KOL INVESTMENT STYLE: ${knowledge.investmentStyle}`);
  }
  if (knowledge.notes && knowledge.notes.length > 0) {
    parts.push(
      `KOL-SPECIFIC NOTES:\n${knowledge.notes.map((n) => `- ${n}`).join("\n")}`,
    );
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Direct allocation snapshot (bypasses LLM entirely)
// ---------------------------------------------------------------------------

async function buildDirectAllocationSnapshot(
  quantId: string,
  directAllocations: { asset: string; percentage: number }[],
  tradeableAssets: Map<string, { mint: string; decimals: number }>,
): Promise<boolean> {
  const now = new Date().toISOString();

  // Normalize symbols and build Allocation objects
  let allocations: Allocation[] = directAllocations.map((da) => ({
    asset: normalizeAsset(da.asset),
    percentage: da.percentage,
    conviction: "high" as const,
    reasoning: "Direct allocation from quant",
    since: now,
    lastSignal: now,
  }));

  // Merge same-group allocations (e.g. SOL + JitoSOL → JitoSOL)
  allocations = mergeAssetGroupAllocations(allocations);

  // Resolve mints
  for (const alloc of allocations) {
    if (alloc.asset === "USDC") continue;
    const info = tradeableAssets.get(alloc.asset);
    if (!info) {
      logger.warn(
        { quantId, asset: alloc.asset },
        "Direct allocation asset not tradeable, skipping mint",
      );
      continue;
    }
    alloc.mint = info.mint;
  }

  await portfolioRepo.createSnapshot({
    quantId,
    thesisSummary: "Portfolio directly specified by quant.",
    allocations: allocations as unknown as Prisma.InputJsonValue,
    changes: ["Direct allocation override"],
    sourceTweetIds: [],
  });

  logger.info(
    { quantId, allocations: allocations.length },
    "Direct allocation snapshot saved",
  );
  return true;
}

// ---------------------------------------------------------------------------
// Single snapshot synthesis (extracted for reuse by both incremental & retroactive paths)
// ---------------------------------------------------------------------------

interface SingleSnapshotInput {
  quantId: string;
  userContent: string;
  sourceTweetIds: string[];
  previousSnapshot: PortfolioSnapshot | null;
  createdAt?: Date;
  decayReferenceDate?: Date;
  knowledgeContext?: string;
}

async function synthesizeSingleSnapshot(
  input: SingleSnapshotInput,
  tradeableAssets: Map<string, { mint: string; decimals: number }>,
): Promise<{ snapshot: PortfolioSnapshot; allocations: Allocation[] } | null> {
  const {
    quantId,
    userContent,
    sourceTweetIds,
    previousSnapshot,
    createdAt,
    decayReferenceDate,
    knowledgeContext,
  } = input;

  const availableSymbols = getCuratedAssetSymbols();
  const thesisPrompt = buildThesisSystemPrompt(
    availableSymbols,
    knowledgeContext,
  );

  logger.info(
    { quantId, availableAssetsCount: availableSymbols.length },
    "Sending thesis prompt to LLM",
  );

  let rawResponse: string;
  try {
    rawResponse = await llmComplete(thesisPrompt, userContent);
  } catch (err) {
    logger.error({ err, quantId }, "LLM call failed for thesis synthesis");
    return null;
  }

  logger.info(
    { quantId, responseLength: rawResponse.length },
    "LLM response received",
  );

  let parsed: unknown;
  try {
    parsed = extractJson(rawResponse);
  } catch {
    logger.error({ quantId, rawResponse }, "Failed to parse thesis JSON");
    return null;
  }

  const result = PortfolioOutputSchema.safeParse(parsed);
  if (!result.success) {
    logger.error(
      { quantId, errors: result.error.issues },
      "Thesis response failed schema validation",
    );
    return null;
  }

  const portfolio = result.data;

  logger.info(
    { quantId, thesisSummary: portfolio.thesisSummary },
    "Thesis summary",
  );

  // Validate allocations sum roughly to 100%
  const totalPct = portfolio.allocations.reduce(
    (sum, a) => sum + a.percentage,
    0,
  );
  logger.info({ quantId, totalPct }, "Allocation total percentage");

  if (totalPct < 95 || totalPct > 105) {
    logger.error(
      { quantId, totalPct },
      "Allocation percentages don't sum to ~100%, rejecting",
    );
    return null;
  }

  for (const alloc of portfolio.allocations) {
    logger.info(
      {
        quantId,
        asset: alloc.asset,
        percentage: alloc.percentage,
        conviction: alloc.conviction,
        reasoning: alloc.reasoning,
        since: alloc.since,
        lastSignal: alloc.lastSignal,
      },
      "Allocation",
    );
  }

  // Normalize LLM output symbols via aliases (e.g. BTC → cbBTC)
  for (const alloc of portfolio.allocations) {
    alloc.asset = normalizeAsset(alloc.asset);
  }

  // Merge same-group allocations (e.g. SOL + JitoSOL → JitoSOL)
  const beforeCount = portfolio.allocations.length;
  portfolio.allocations = mergeAssetGroupAllocations(
    portfolio.allocations as unknown as Allocation[],
  );
  if (portfolio.allocations.length < beforeCount) {
    logger.info(
      { quantId, before: beforeCount, after: portfolio.allocations.length },
      "Merged same-group allocations",
    );
  }

  // Resolve mints from tradeable assets map
  for (const alloc of portfolio.allocations) {
    if (alloc.asset === "USDC") continue;
    const tradeableInfo = tradeableAssets.get(alloc.asset);
    if (!tradeableInfo) {
      logger.warn(
        { quantId, asset: alloc.asset },
        "Asset not in tradeable assets, skipping",
      );
      continue;
    }
    alloc.mint = tradeableInfo.mint;
  }

  // Apply conviction decay
  const decayedAllocations = applyConvictionDecay(
    portfolio.allocations as unknown as Allocation[],
    decayReferenceDate ?? new Date(),
  );

  // Log changes
  if (portfolio.changes.length > 0) {
    for (const change of portfolio.changes) {
      logger.info({ quantId, change }, "Portfolio change");
    }
  } else {
    logger.info({ quantId }, "No portfolio changes");
  }

  const savedSnapshot = await portfolioRepo.createSnapshot({
    quantId,
    thesisSummary: portfolio.thesisSummary,
    allocations: decayedAllocations as unknown as Prisma.InputJsonValue,
    changes: portfolio.changes,
    sourceTweetIds,
    ...(createdAt ? { createdAt } : {}),
  });

  logger.info(
    {
      quantId,
      allocations: decayedAllocations.length,
      changes: portfolio.changes.length,
      createdAt: createdAt?.toISOString(),
    },
    "Portfolio snapshot saved",
  );

  // Compute tweet impact scores (non-fatal)
  try {
    const oldAllocations = previousSnapshot
      ? (previousSnapshot.allocations as unknown as Allocation[])
      : null;
    await computeTweetImpacts({
      quantId,
      snapshotId: savedSnapshot.id,
      sourceTweetIds,
      oldAllocations,
      newAllocations: decayedAllocations as unknown as Allocation[],
    });
  } catch (err) {
    logger.warn(
      { err, quantId },
      "Failed to compute tweet impacts (non-fatal)",
    );
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

export function generateWeeklyWindows(
  earliest: Date,
  latest: Date,
): TimeWindow[] {
  const windows: TimeWindow[] = [];

  // Find Monday 00:00:00 UTC of the week containing `earliest`
  const day = earliest.getUTCDay(); // 0=Sun, 1=Mon...
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const firstMonday = new Date(
    Date.UTC(
      earliest.getUTCFullYear(),
      earliest.getUTCMonth(),
      earliest.getUTCDate() + mondayOffset,
    ),
  );

  let windowStart = firstMonday;

  while (windowStart.getTime() <= latest.getTime()) {
    // Sunday 23:59:59.999 UTC of this week
    const sundayEnd = new Date(
      windowStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1,
    );

    // Cap last window at `latest`
    const windowEnd =
      sundayEnd.getTime() > latest.getTime() ? latest : sundayEnd;

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
  quantId: string,
  allRelevant: ClassificationWithTweet[],
  knowledgeContext?: string,
): Promise<boolean> {
  const tradeableAssets = await getTradeableAssetsMap();

  // Sort by tweet posted date (not classifiedAt which is bulk classification time)
  const sorted = [...allRelevant].sort(
    (a, b) => a.tweet.postedAt.getTime() - b.tweet.postedAt.getTime(),
  );

  const earliest = sorted[0]!.tweet.postedAt;
  const latest = sorted[sorted.length - 1]!.tweet.postedAt;
  const windows = generateWeeklyWindows(earliest, latest);

  logger.info(
    {
      quantId,
      totalTweets: sorted.length,
      windows: windows.length,
      earliest: earliest.toISOString(),
      latest: latest.toISOString(),
    },
    "Generating retroactive weekly snapshots",
  );

  let previousSnapshot: PortfolioSnapshot | null = null;
  let cumulativeTweets: ClassificationWithTweet[] = [];
  let generatedCount = 0;

  for (const window of windows) {
    // Collect tweets in this window
    const windowTweets = sorted.filter(
      (c) =>
        c.tweet.postedAt >= window.startDate &&
        c.tweet.postedAt <= window.endDate,
    );

    if (windowTweets.length === 0) continue;

    cumulativeTweets = [...cumulativeTweets, ...windowTweets];
    const sourceTweetIds = windowTweets.map((c) => c.tweetId);

    let userContent: string;

    if (!previousSnapshot) {
      // First window: cold start from all tweets up to this point
      const tweetsFormatted =
        formatClassificationsWithThreads(cumulativeTweets);
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
      {
        quantId,
        windowStart: window.startDate.toISOString(),
        windowEnd: window.endDate.toISOString(),
        tweetsInWindow: windowTweets.length,
      },
      "Processing retroactive window",
    );

    const result = await synthesizeSingleSnapshot(
      {
        quantId,
        userContent,
        sourceTweetIds,
        previousSnapshot,
        createdAt: window.endDate,
        decayReferenceDate: window.endDate,
        ...(knowledgeContext ? { knowledgeContext } : {}),
      },
      tradeableAssets,
    );

    if (result) {
      previousSnapshot = result.snapshot;
      generatedCount++;
      logger.info(
        { quantId, generatedCount, windowEnd: window.endDate.toISOString() },
        "Generated retroactive snapshot",
      );
    } else {
      logger.warn(
        { quantId, windowEnd: window.endDate.toISOString() },
        "Failed to generate retroactive snapshot for window, continuing",
      );
    }
  }

  logger.info(
    { quantId, generatedCount, totalWindows: windows.length },
    "Retroactive snapshot generation complete",
  );
  return generatedCount > 0;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function synthesizeThesis(quantId: string): Promise<boolean> {
  const tradeableAssets = await getTradeableAssetsMap();

  logger.info(
    { quantId, tradeableAssetsCount: tradeableAssets.size },
    "Starting thesis synthesis",
  );

  // --- Build knowledge context ---
  const globalKnowledge = buildGlobalKnowledgeContext();
  const quant = await findQuantById(quantId);
  let kolKnowledge = "";
  if (quant?.knowledge) {
    const parsed = KolKnowledgeSchema.safeParse(quant.knowledge);
    if (parsed.success) {
      // --- Direct allocation override: skip all LLM logic ---
      if (
        parsed.data.useDirectAllocations &&
        parsed.data.directAllocations?.length
      ) {
        logger.info(
          { quantId, allocations: parsed.data.directAllocations.length },
          "Using direct allocations (bypassing LLM)",
        );
        return buildDirectAllocationSnapshot(
          quantId,
          parsed.data.directAllocations,
          tradeableAssets,
        );
      }
      kolKnowledge = formatKolKnowledge(parsed.data);
    } else {
      logger.warn(
        { quantId, errors: parsed.error.issues },
        "Invalid KOL knowledge JSON, ignoring",
      );
    }
  }
  const knowledgeContext = [globalKnowledge, kolKnowledge]
    .filter(Boolean)
    .join("\n\n");

  // --- Retroactive backfill: check for tweets older than earliest snapshot ---
  const earliestSnapshot = await portfolioRepo.findEarliestSnapshot(quantId);
  const allRelevant =
    await classificationRepo.findRelevantClassificationsSince(
      quantId,
      new Date(0),
    );

  if (allRelevant.length > 0) {
    const oldestTweetDate = allRelevant.reduce(
      (min, c) => (c.tweet.postedAt < min ? c.tweet.postedAt : min),
      allRelevant[0]!.tweet.postedAt,
    );

    if (!earliestSnapshot) {
      // Cold start: no snapshots at all → full retroactive generation
      logger.info(
        { quantId },
        "Cold start — generating retroactive weekly snapshots",
      );
      return generateRetroactiveSnapshots(quantId, allRelevant, knowledgeContext);
    }

    if (oldestTweetDate < earliestSnapshot.createdAt) {
      // Gap detected: tweets exist before earliest snapshot → backfill the gap
      const tweetsBeforeEarliest = allRelevant.filter(
        (c) => c.tweet.postedAt < earliestSnapshot.createdAt,
      );
      logger.info(
        {
          quantId,
          gap: `${oldestTweetDate.toISOString()} → ${earliestSnapshot.createdAt.toISOString()}`,
          tweetsInGap: tweetsBeforeEarliest.length,
        },
        "Gap detected — backfilling retroactive snapshots before earliest existing snapshot",
      );
      await generateRetroactiveSnapshots(quantId, tweetsBeforeEarliest, knowledgeContext);
      // Fall through to incremental path for new tweets
    }
  }

  // --- Incremental update ---
  // Re-fetch latestSnapshot since retroactive backfill may have created new ones
  const currentLatest = await portfolioRepo.findLatestSnapshot(quantId);
  if (!currentLatest) {
    logger.info({ quantId }, "No snapshots and no relevant tweets, skipping");
    return false;
  }

  const newRelevant =
    await classificationRepo.findRelevantClassificationsSince(
      quantId,
      currentLatest.createdAt,
    );
  if (newRelevant.length === 0) {
    logger.info(
      { quantId },
      "No new relevant tweets since last snapshot, skipping",
    );
    return false;
  }

  const sourceTweetIds = newRelevant.map((c) => c.tweetId);

  logger.info(
    { quantId, newRelevantTweets: newRelevant.length },
    "Found new relevant tweets since last snapshot",
  );

  const currentState = JSON.stringify({
    thesisSummary: currentLatest.thesisSummary,
    allocations: currentLatest.allocations,
  });
  const tweetsFormatted = formatClassificationsWithThreads(newRelevant);
  const userContent = `CURRENT THESIS STATE (carry forward unless contradicted):\n${currentState}\n\nNEW RELEVANT TWEETS (since last update, chronological):\n${tweetsFormatted}`;

  const result = await synthesizeSingleSnapshot(
    { quantId, userContent, sourceTweetIds, previousSnapshot: currentLatest, knowledgeContext },
    tradeableAssets,
  );

  if (!result) return false;

  // Compute backtest performance for this new period (non-fatal)
  try {
    await computeLatestPeriod(quantId);
  } catch (err) {
    logger.warn(
      { err, quantId },
      "Failed to compute period performance (non-fatal)",
    );
  }

  return true;
}

export async function synthesizeAllQuants(): Promise<void> {
  const quants = await findActiveQuants();
  logger.info({ count: quants.length }, "Running algo for all active Quants");

  let processed = 0;
  let skipped = 0;
  let updated = 0;

  for (const quant of quants) {
    if (!quant.user.hasTwitter) {
      logger.info(
        { username: quant.user.twitterUsername },
        "Skipping non-Twitter Quant for algo",
      );
      continue;
    }

    if (!quant.algoEnabled) {
      logger.info(
        { username: quant.user.twitterUsername },
        "Algo disabled for Quant, skipping",
      );
      continue;
    }

    logger.info(
      {
        quantId: quant.id,
        username: quant.user.twitterUsername,
        progress: `${processed + 1}/${quants.length}`,
      },
      "Processing Quant",
    );

    try {
      const classified = await classifyUnclassifiedTweets(quant.id);
      logger.info(
        { quantId: quant.id, username: quant.user.twitterUsername, classified },
        "Classification done",
      );

      const didUpdate = await synthesizeThesis(quant.id);
      if (didUpdate) {
        updated++;
      } else {
        skipped++;
      }
      logger.info(
        { quantId: quant.id, username: quant.user.twitterUsername, didUpdate },
        "Thesis synthesis done",
      );
    } catch (err) {
      logger.error(
        { err, quantId: quant.id, username: quant.user.twitterUsername },
        "Algo failed for Quant",
      );
    }

    processed++;
  }

  logger.info(
    { total: quants.length, processed, updated, skipped },
    "Algo run summary",
  );
}
