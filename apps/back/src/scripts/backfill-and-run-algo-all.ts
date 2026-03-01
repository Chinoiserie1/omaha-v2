import { writeFileSync } from "node:fs";
import { prisma } from "@repo/database";
import { RateLimitError } from "../utils/errors.js";
import { backfillKolTweets } from "../services/kol.service.js";
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
  console.info("  maxPages        Number of tweet pages to backfill per KOL (default: 10, ~400 tweets)");
  console.info("  --skip-backfill Skip tweet backfill, only run algo");
  console.info("  --skip-algo     Skip classify+thesis, only backfill tweets");
  process.exit(0);
}

interface KolResult {
  username: string;
  tweetsUpserted: number;
  classified: number;
  thesisUpdated: boolean;
  error?: string;
}

async function run(): Promise<void> {
  const kols = await prisma.kol.findMany({
    where: { hasTwitter: true, isActive: true },
    orderBy: { username: "asc" },
  });

  console.info(`Found ${kols.length} active Twitter KOLs`);
  console.info(
    `Config: maxPages=${maxPages}, backfill=${!skipBackfill}, algo=${!skipAlgo}`,
  );

  const results: KolResult[] = [];
  let failures = 0;

  for (let i = 0; i < kols.length; i++) {
    const kol = kols[i]!;
    const progress = `[${i + 1}/${kols.length}]`;
    console.info(`\n${progress} Processing ${kol.username}...`);

    const result: KolResult = {
      username: kol.username,
      tweetsUpserted: 0,
      classified: 0,
      thesisUpdated: false,
    };

    try {
      // Backfill tweets
      if (!skipBackfill) {
        const { totalUpserted } = await backfillKolTweets(kol.id, maxPages);
        result.tweetsUpserted = totalUpserted;
        console.info(`${progress} ${kol.username}: ${totalUpserted} tweets upserted`);
      }

      // Classify + Thesis
      if (!skipAlgo) {
        const classified = await classifyUnclassifiedTweets(kol.id);
        result.classified = classified;
        console.info(`${progress} ${kol.username}: ${classified} tweets classified`);

        const didUpdate = await synthesizeThesis(kol.id);
        result.thesisUpdated = didUpdate;
        console.info(`${progress} ${kol.username}: thesis updated=${didUpdate}`);
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.error(
          `\n${progress} Rate limited on ${kol.username}. Stopping batch.`,
        );
        result.error = "rate_limited";
        results.push(result);
        failures++;
        break;
      }

      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${progress} ${kol.username} failed: ${msg}`);
      result.error = msg;
      failures++;
    }

    results.push(result);
  }

  // Summary
  console.info("\n=== SUMMARY ===");
  console.info(`Total KOLs processed: ${results.length}/${kols.length}`);
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
    console.info("\nFailed KOLs:");
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
