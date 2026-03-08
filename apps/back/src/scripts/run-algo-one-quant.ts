import { prisma } from "@repo/database";
import { classifyUnclassifiedTweets } from "../services/classifier.service.js";
import { synthesizeThesis } from "../services/thesis.service.js";

const username = process.argv[2];

if (!username) {
  console.error("Usage: tsx src/scripts/run-algo-one-quant.ts <username>");
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

  console.info(`Running algo for ${quant.user.twitterUsername} (${quant.id})`);

  // Check thread data first
  const threadCount = await prisma.tweet.groupBy({
    by: ["conversationId"],
    where: { quantId: quant.id, conversationId: { not: null } },
    _count: true,
    having: { conversationId: { _count: { gt: 1 } } },
  });
  console.info(`Thread conversations with 2+ tweets: ${threadCount.length}`);

  const unclassified = await prisma.tweet.count({
    where: { quantId: quant.id, classification: null },
  });
  console.info(`Unclassified tweets: ${unclassified}`);

  const classified = await classifyUnclassifiedTweets(quant.id);
  console.info(`Classified: ${classified}`);

  const result = await synthesizeThesis(quant.id);
  console.info(`Thesis updated: ${result.updated}`);
}

run()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
