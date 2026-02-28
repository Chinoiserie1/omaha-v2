import { prisma } from "@repo/database";
import { classifyUnclassifiedTweets } from "../services/classifier.service.js";
import { synthesizeThesis } from "../services/thesis.service.js";

const username = process.argv[2];

if (!username) {
  console.error("Usage: tsx src/scripts/run-algo-one-kol.ts <username>");
  process.exit(1);
}

async function run(): Promise<void> {
  const kol = await prisma.kol.findFirst({ where: { username: username! } });
  if (!kol) {
    console.error(`KOL "${username}" not found`);
    process.exit(1);
  }

  console.info(`Running algo for ${kol.username} (${kol.id})`);

  // Check thread data first
  const threadCount = await prisma.tweet.groupBy({
    by: ["conversationId"],
    where: { kolId: kol.id, conversationId: { not: null } },
    _count: true,
    having: { conversationId: { _count: { gt: 1 } } },
  });
  console.info(`Thread conversations with 2+ tweets: ${threadCount.length}`);

  const unclassified = await prisma.tweet.count({
    where: { kolId: kol.id, classification: null },
  });
  console.info(`Unclassified tweets: ${unclassified}`);

  const classified = await classifyUnclassifiedTweets(kol.id);
  console.info(`Classified: ${classified}`);

  const didUpdate = await synthesizeThesis(kol.id);
  console.info(`Thesis updated: ${didUpdate}`);
}

run()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
