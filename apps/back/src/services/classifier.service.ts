import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";
import { llmComplete } from "../utils/llm.js";
import { extractJson } from "../utils/extract-json.js";
import {
  ClassificationBatchSchema,
  CLASSIFICATION_SYSTEM_PROMPT,
} from "@repo/shared";
import * as classificationRepo from "../store/classification.repository.js";
import { findThreadByConversationId } from "../store/tweet.repository.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const aliasPath = resolve(__dirname, "../data/asset-aliases.json");
const assetAliases: Record<string, string> = JSON.parse(
  readFileSync(aliasPath, "utf-8")
);

function normalizeAsset(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return assetAliases[lower] ?? raw.toUpperCase();
}

const BATCH_SIZE = 30;

interface ClassificationUnit {
  text: string;
  tweetIds: string[];
}

export async function classifyUnclassifiedTweets(
  kolId: string
): Promise<number> {
  const tweets = await classificationRepo.findUnclassifiedTweetsByKol(kolId);

  if (tweets.length === 0) {
    logger.info({ kolId }, "No unclassified tweets found");
    return 0;
  }

  // Group tweets by conversationId to classify threads as single units
  const threadGroups = new Map<string, typeof tweets>();
  const soloTweets: typeof tweets = [];

  for (const tweet of tweets) {
    if (tweet.conversationId) {
      const group = threadGroups.get(tweet.conversationId);
      if (group) {
        group.push(tweet);
      } else {
        threadGroups.set(tweet.conversationId, [tweet]);
      }
    } else {
      soloTweets.push(tweet);
    }
  }

  // Build classification units (each unit = one item for the LLM)
  const units: ClassificationUnit[] = [];

  for (const tweet of soloTweets) {
    units.push({ text: tweet.fullText, tweetIds: [tweet.id] });
  }

  for (const [conversationId, groupTweets] of threadGroups) {
    // Fetch full thread (includes already-classified tweets) for context
    const fullThread = await findThreadByConversationId(conversationId);
    const text =
      fullThread.length > 1
        ? `[THREAD - ${fullThread.length} tweets]\n${fullThread.map((t) => t.fullText).join("\n---\n")}`
        : fullThread[0]?.fullText ?? groupTweets[0]!.fullText;

    units.push({ text, tweetIds: groupTweets.map((t) => t.id) });
  }

  const batches = Math.ceil(units.length / BATCH_SIZE);
  logger.info(
    { kolId, tweetCount: tweets.length, units: units.length, threads: threadGroups.size, batches },
    "Starting classification"
  );

  let totalClassified = 0;
  let noiseCount = 0;
  let relevantCount = 0;

  for (let i = 0; i < units.length; i += BATCH_SIZE) {
    const batch = units.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    logger.info(
      { kolId, batch: `${batchNum}/${batches}`, batchSize: batch.length },
      "Sending batch to LLM"
    );

    const formatted = batch
      .map((u, idx) => `INDEX: ${idx}\nText: ${u.text}\n---`)
      .join("\n");

    let rawResponse: string;
    try {
      rawResponse = await llmComplete(CLASSIFICATION_SYSTEM_PROMPT, formatted);
    } catch (err) {
      logger.error({ err, kolId, batch: batchNum }, "LLM call failed for batch");
      continue;
    }

    let parsed: unknown;
    try {
      parsed = extractJson(rawResponse);
    } catch {
      logger.error({ kolId, batch: batchNum, rawResponse }, "Failed to parse LLM JSON response");
      continue;
    }

    const result = ClassificationBatchSchema.safeParse(parsed);
    if (!result.success) {
      logger.error(
        { kolId, batch: batchNum, errors: result.error.issues },
        "LLM response failed schema validation"
      );
      continue;
    }

    logger.info(
      { kolId, batch: batchNum, classifications: result.data.classifications.length },
      "Batch parsed successfully"
    );

    for (const classification of result.data.classifications) {
      if (classification.index < 0 || classification.index >= batch.length) {
        logger.warn(
          { kolId, index: classification.index, batchSize: batch.length },
          "LLM returned out-of-bounds index, skipping"
        );
        continue;
      }

      const unit = batch[classification.index]!;
      const normalizedAssets = classification.assets.map(normalizeAsset);
      const isNoise = classification.category === "noise";

      if (isNoise) {
        noiseCount++;
      } else {
        relevantCount++;
        logger.info(
          {
            kolId,
            tweetIds: unit.tweetIds,
            category: classification.category,
            assets: normalizedAssets,
            sentiment: classification.sentiment,
            conviction: classification.conviction,
          },
          "Relevant tweet(s) classified"
        );
      }

      // Apply same classification to all tweets in the unit (thread or solo)
      for (const tweetId of unit.tweetIds) {
        try {
          await classificationRepo.createClassification({
            tweetId,
            category: classification.category,
            assets: normalizedAssets,
            sentiment: classification.sentiment,
            conviction: classification.conviction,
            rawLlmResponse: parsed,
          });
          totalClassified++;
        } catch (err) {
          logger.error(
            { err, tweetId },
            "Failed to store classification"
          );
        }
      }
    }
  }

  logger.info(
    { kolId, totalClassified, relevant: relevantCount, noise: noiseCount },
    "Classification complete"
  );
  return totalClassified;
}
