/**
 * Run backtest for a KOL and output JSON for charting.
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
  const kol = await prisma.kol.findFirst({ where: { username: username as string } });
  if (!kol) {
    console.error(`KOL "${username}" not found`);
    process.exit(1);
  }

  console.error(`Running backtest for ${kol.username} (${kol.id})...`);
  const result = await runBacktest(kol.id);

  // Output clean JSON to stdout
  console.log(JSON.stringify(result, null, 2));
}

run()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
