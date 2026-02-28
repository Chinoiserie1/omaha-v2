import { prisma } from "@repo/database";
import { env } from "../utils/env.js";
import { delay } from "../utils/delay.js";
import { RateLimitError } from "../utils/errors.js";
import * as twitterService from "../services/twitter.service.js";
import { mapTweetResultToInput } from "../services/kol.service.js";
import * as tweetRepo from "../store/tweet.repository.js";

const username = process.argv[2];
const maxPages = parseInt(process.argv[3] ?? "10", 10);

if (!username) {
  console.error(
    "Usage: tsx src/scripts/backfill-tweets.ts <username> [maxPages]",
  );
  console.error("  maxPages defaults to 10 (~400 tweets)");
  process.exit(1);
}

async function run(): Promise<void> {
  const kol = await prisma.kol.findFirst({ where: { username: username! } });
  if (!kol) {
    console.error(`KOL "${username}" not found`);
    process.exit(1);
  }

  if (!kol.restId) {
    console.error(
      `KOL "${username}" has no restId. Run a profile sync first.`,
    );
    process.exit(1);
  }

  console.info(
    `Backfilling tweets for ${kol.username} (restId: ${kol.restId}), max ${maxPages} pages`,
  );

  let cursor: string | null = null;
  let totalUpserted = 0;
  let oldestDate: Date | null = null;

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) {
      await delay(env.FETCH_DELAY_MS);
    }

    const result = await twitterService.fetchUserTweets(
      kol.restId,
      cursor ?? undefined,
    );

    if (result.tweets.length === 0) {
      console.info(`Page ${page}: no tweets returned, stopping`);
      break;
    }

    let pageUpserted = 0;
    for (const tweet of result.tweets) {
      const input = mapTweetResultToInput(tweet, kol.id);
      await tweetRepo.upsertTweet(input);
      pageUpserted++;

      const tweetDate = new Date(tweet.legacy.created_at);
      if (!oldestDate || tweetDate < oldestDate) {
        oldestDate = tweetDate;
      }
    }

    totalUpserted += pageUpserted;
    console.info(
      `Page ${page}: ${pageUpserted} tweets upserted (total: ${totalUpserted}, oldest: ${oldestDate?.toISOString()})`,
    );

    cursor = result.cursor;
    if (!cursor) {
      console.info("No more pages (cursor exhausted)");
      break;
    }
  }

  console.info(
    `Done. Total tweets upserted: ${totalUpserted}, oldest: ${oldestDate?.toISOString() ?? "N/A"}`,
  );
}

run()
  .catch((err) => {
    if (err instanceof RateLimitError) {
      console.error("Rate limited. Try again later.");
    } else {
      console.error("Failed:", err);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
