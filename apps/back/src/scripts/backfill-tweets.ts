import { prisma } from "@repo/database";
import { RateLimitError } from "../utils/errors.js";
import { backfillQuantTweets } from "../services/quant.service.js";

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
  const quant = await prisma.quant.findFirst({
    where: { user: { twitterUsername: username! } },
    include: { user: true },
  });
  if (!quant) {
    console.error(`Quant "${username}" not found`);
    process.exit(1);
  }

  console.info(
    `Backfilling tweets for ${quant.user.twitterUsername}, max ${maxPages} pages`,
  );

  const { totalUpserted, oldestDate } = await backfillQuantTweets(
    quant.id,
    maxPages,
  );

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
