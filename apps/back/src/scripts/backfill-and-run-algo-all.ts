import { writeFileSync } from "node:fs";
import { prisma } from "@repo/database";
import { RateLimitError } from "../utils/errors.js";
import { backfillQuantTweets } from "../services/quant.service.js";
import { classifyUnclassifiedTweets } from "../services/classifier.service.js";
import { synthesizeThesis } from "../services/thesis.service.js";

const args = process.argv.slice(2);
const skipBackfill = args.includes("--skip-backfill");
const skipAlgo = args.includes("--skip-algo");
const maxPages = parseInt(
  args.find((a) => !a.startsWith("--")) ?? "10",
  10,
);

if (args.includes("--help") || args.includes("-h")) {
  console.info(
    "Usage: tsx src/scripts/backfill-and-run-algo-all.ts [maxPages] [--skip-backfill] [--skip-algo]",
  );
  console.info("  maxPages        Number of tweet pages to backfill per Quant (default: 10, ~400 tweets)");
  console.info("  --skip-backfill Skip tweet backfill, only run algo");
  console.info("  --skip-algo     Skip classify+thesis, only backfill tweets");
  process.exit(0);
}

interface QuantResult {
  username: string;
  tweetsUpserted: number;
  classified: number;
  thesisUpdated: boolean;
  error?: string;
}

async function run(): Promise<void> {
  const quants = await prisma.quant.findMany({
    where: { user: { hasTwitter: true }, isActive: true },
    include: { user: true },
    orderBy: { user: { twitterUsername: "asc" } },
  });

  console.info(`Found ${quants.length} active Twitter Quants`);
  console.info(
    `Config: maxPages=${maxPages}, backfill=${!skipBackfill}, algo=${!skipAlgo}`,
  );

  const results: QuantResult[] = [];
  let failures = 0;

  for (let i = 0; i < quants.length; i++) {
    const quant = quants[i]!;
    const username = quant.user.twitterUsername ?? quant.id;
    const progress = `[${i + 1}/${quants.length}]`;
    console.info(`\n${progress} Processing ${username}...`);

    const result: QuantResult = {
      username,
      tweetsUpserted: 0,
      classified: 0,
      thesisUpdated: false,
    };

    try {
      // Backfill tweets
      if (!skipBackfill) {
        const { totalUpserted } = await backfillQuantTweets(quant.id, maxPages);
        result.tweetsUpserted = totalUpserted;
        console.info(`${progress} ${username}: ${totalUpserted} tweets upserted`);
      }

      // Classify + Thesis
      if (!skipAlgo) {
        const classified = await classifyUnclassifiedTweets(quant.id);
        result.classified = classified;
        console.info(`${progress} ${username}: ${classified} tweets classified`);

        const didUpdate = await synthesizeThesis(quant.id);
        result.thesisUpdated = didUpdate;
        console.info(`${progress} ${username}: thesis updated=${didUpdate}`);
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.error(
          `\n${progress} Rate limited on ${username}. Stopping batch.`,
        );
        result.error = "rate_limited";
        results.push(result);
        failures++;
        break;
      }

      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${progress} ${username} failed: ${msg}`);
      result.error = msg;
      failures++;
    }

    results.push(result);
  }

  // Summary
  console.info("\n=== SUMMARY ===");
  console.info(`Total Quants processed: ${results.length}/${quants.length}`);
  console.info(
    `Tweets upserted: ${results.reduce((s, r) => s + r.tweetsUpserted, 0)}`,
  );
  console.info(
    `Tweets classified: ${results.reduce((s, r) => s + r.classified, 0)}`,
  );
  console.info(
    `Theses updated: ${results.filter((r) => r.thesisUpdated).length}`,
  );
  console.info(`Failures: ${failures}`);

  if (failures > 0) {
    console.info("\nFailed Quants:");
    for (const r of results.filter((r) => r.error)) {
      console.info(`  - ${r.username}: ${r.error}`);
    }
  }

  // Write CSV report
  const csvHeader = "username,tweets_upserted,classified,thesis_updated,error";
  const csvRows = results.map(
    (r) =>
      `${r.username},${r.tweetsUpserted},${r.classified},${r.thesisUpdated},${r.error ?? ""}`,
  );
  const csvContent = [csvHeader, ...csvRows].join("\n");
  const csvPath = `backfill-algo-all-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
  writeFileSync(csvPath, csvContent);
  console.info(`\nCSV report written to ${csvPath}`);
}

run()
  .catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
