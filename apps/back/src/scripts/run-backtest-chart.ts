/**
 * Run backtest for a Quant and output JSON for charting.
 * Usage: DATABASE_URL="..." pnpm --filter @repo/back exec tsx src/scripts/run-backtest-chart.ts mert
 */
import { prisma } from "@repo/database";
import { runBacktest } from "../services/backtest.service.js";

const username = process.argv[2];
if (!username) {
  console.error("Usage: tsx src/scripts/run-backtest-chart.ts <username>");
  process.exit(1);
}

async function run() {
  const quant = await prisma.quant.findFirst({
    where: { user: { twitterUsername: username as string } },
    include: { user: true },
  });
  if (!quant) {
    console.error(`Quant "${username}" not found`);
    process.exit(1);
  }

  console.error(`Running backtest for ${quant.user.twitterUsername} (${quant.id})...`);
  const result = await runBacktest(quant.id);

  // Output clean JSON to stdout
  console.log(JSON.stringify(result, null, 2));
}

run()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
