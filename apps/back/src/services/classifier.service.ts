import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";
import { llmComplete } from "../utils/llm.js";
import {
  ClassificationBatchSchema,
  CLASSIFICATION_SYSTEM_PROMPT,
} from "@repo/shared";
import * as classificationRepo from "../store/classification.repository.js";

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

export async function classifyUnclassifiedTweets(
  kolId: string
): Promise<number> {
  const tweets = await classificationRepo.findUnclassifiedTweetsByKol(kolId);

  if (tweets.length === 0) {
    logger.info({ kolId }, "No unclassified tweets found");
    return 0;
  }

  const batches = Math.ceil(tweets.length / BATCH_SIZE);
  logger.info(
    { kolId, tweetCount: tweets.length, batches },
    "Starting classification"
  );

  let totalClassified = 0;
  let noiseCount = 0;
  let relevantCount = 0;

  for (let i = 0; i < tweets.length; i += BATCH_SIZE) {
    const batch = tweets.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    logger.info(
      { kolId, batch: `${batchNum}/${batches}`, batchSize: batch.length },
      "Sending batch to LLM"
    );

    const formatted = batch
      .map((t, idx) => `INDEX: ${idx}\nText: ${t.fullText}\n---`)
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
      const cleaned = rawResponse.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");
      parsed = JSON.parse(cleaned);
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

      const tweet = batch[classification.index]!;
      const normalizedAssets = classification.assets.map(normalizeAsset);
      const isNoise = classification.category === "noise";

      if (isNoise) {
        noiseCount++;
      } else {
        relevantCount++;
        logger.info(
          {
            kolId,
            tweetId: tweet.id,
            category: classification.category,
            assets: normalizedAssets,
            sentiment: classification.sentiment,
            conviction: classification.conviction,
          },
          "Relevant tweet classified"
        );
      }

      try {
        await classificationRepo.createClassification({
          tweetId: tweet.id,
          category: classification.category,
          assets: normalizedAssets,
          sentiment: classification.sentiment,
          conviction: classification.conviction,
          rawLlmResponse: parsed,
        });
        totalClassified++;
      } catch (err) {
        logger.error(
          { err, tweetId: tweet.id },
          "Failed to store classification"
        );
      }
    }
  }

  logger.info(
    { kolId, totalClassified, relevant: relevantCount, noise: noiseCount },
    "Classification complete"
  );
  return totalClassified;
}
