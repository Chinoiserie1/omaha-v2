/**
 * Data migration: Convert JSON blobs in PortfolioSnapshot.allocations
 * and HoldingsSnapshot.holdings into relational rows in
 * SnapshotAllocation and SnapshotHolding tables.
 *
 * Run AFTER the Prisma migration that creates the new tables.
 * Idempotent — skips snapshots that already have relational rows.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm --filter @repo/back exec tsx src/scripts/migrate-json-to-relational.ts
 */

import { prisma } from "@repo/database";

const BATCH_SIZE = 100;

interface LegacyAllocation {
  asset: string;
  mint?: string;
  percentage: number;
  conviction: string;
  reasoning: string;
  since: string;
  lastSignal: string;
}

interface LegacyHolding {
  mint: string;
  symbol: string;
  uiAmount: number;
  price: number;
  valueUsd: number;
  percentage: number;
}

async function buildTokenMap(): Promise<Map<string, string>> {
  const tokens = await prisma.token.findMany({
    select: { id: true, mint: true },
  });
  const map = new Map<string, string>();
  for (const t of tokens) {
    map.set(t.mint, t.id);
  }
  return map;
}

async function migrateAllocations(tokenMap: Map<string, string>): Promise<void> {
  // Note: After the schema migration removes the `allocations` column,
  // this function will no longer work. It should only be run during
  // the transition period while the JSON column still exists.
  //
  // We use raw SQL to read the legacy JSON column since the Prisma
  // client no longer exposes it after schema.prisma was updated.

  const total = await prisma.portfolioSnapshot.count();
  console.log(`Migrating allocations for ${total} PortfolioSnapshots...`);

  let offset = 0;
  let migrated = 0;
  let skipped = 0;

  while (offset < total) {
    // Use raw query to read the legacy `allocations` JSON column
    const snapshots = await prisma.$queryRawUnsafe<
      Array<{ id: string; allocations: unknown }>
    >(
      `SELECT id, allocations FROM "PortfolioSnapshot" ORDER BY "createdAt" ASC LIMIT $1 OFFSET $2`,
      BATCH_SIZE,
      offset,
    );

    for (const snap of snapshots) {
      // Check if already migrated
      const existingCount = await prisma.snapshotAllocation.count({
        where: { snapshotId: snap.id },
      });
      if (existingCount > 0) {
        skipped++;
        continue;
      }

      const rawAllocations = snap.allocations;
      if (!Array.isArray(rawAllocations)) {
        console.warn(`  Snapshot ${snap.id}: allocations is not an array, skipping`);
        skipped++;
        continue;
      }

      const allocations = rawAllocations as LegacyAllocation[];
      if (allocations.length === 0) {
        skipped++;
        continue;
      }

      await prisma.snapshotAllocation.createMany({
        data: allocations.map((a) => ({
          snapshotId: snap.id,
          asset: a.asset ?? "",
          mint: a.mint ?? null,
          tokenId: a.mint ? (tokenMap.get(a.mint) ?? null) : null,
          percentage: a.percentage ?? 0,
          conviction: a.conviction ?? "low",
          reasoning: a.reasoning ?? "",
          since: a.since ?? "",
          lastSignal: a.lastSignal ?? "",
        })),
      });

      migrated++;
    }

    offset += BATCH_SIZE;
    console.log(`  Progress: ${offset}/${total} (migrated: ${migrated}, skipped: ${skipped})`);
  }

  console.log(`Allocations migration complete: ${migrated} migrated, ${skipped} skipped`);
}

async function migrateHoldings(tokenMap: Map<string, string>): Promise<void> {
  const total = await prisma.holdingsSnapshot.count();
  console.log(`\nMigrating holdings for ${total} HoldingsSnapshots...`);

  let offset = 0;
  let migrated = 0;
  let skipped = 0;

  while (offset < total) {
    const snapshots = await prisma.$queryRawUnsafe<
      Array<{ id: string; holdings: unknown }>
    >(
      `SELECT id, holdings FROM "HoldingsSnapshot" ORDER BY "createdAt" ASC LIMIT $1 OFFSET $2`,
      BATCH_SIZE,
      offset,
    );

    for (const snap of snapshots) {
      // Check if already migrated
      const existingCount = await prisma.snapshotHolding.count({
        where: { snapshotId: snap.id },
      });
      if (existingCount > 0) {
        skipped++;
        continue;
      }

      const rawHoldings = snap.holdings;
      if (!Array.isArray(rawHoldings)) {
        console.warn(`  Snapshot ${snap.id}: holdings is not an array, skipping`);
        skipped++;
        continue;
      }

      const holdings = rawHoldings as LegacyHolding[];
      if (holdings.length === 0) {
        skipped++;
        continue;
      }

      await prisma.snapshotHolding.createMany({
        data: holdings.map((h) => ({
          snapshotId: snap.id,
          mint: h.mint,
          symbol: h.symbol ?? "",
          tokenId: tokenMap.get(h.mint) ?? null,
          uiAmount: h.uiAmount ?? 0,
          price: h.price ?? 0,
          valueUsd: h.valueUsd ?? 0,
          percentage: h.percentage ?? 0,
        })),
      });

      migrated++;
    }

    offset += BATCH_SIZE;
    console.log(`  Progress: ${offset}/${total} (migrated: ${migrated}, skipped: ${skipped})`);
  }

  console.log(`Holdings migration complete: ${migrated} migrated, ${skipped} skipped`);
}

async function verify(): Promise<void> {
  console.log("\nVerification:");

  const snapshotCount = await prisma.portfolioSnapshot.count();
  const allocationSnapshotCount = await prisma.snapshotAllocation.groupBy({
    by: ["snapshotId"],
  });
  console.log(`  PortfolioSnapshots: ${snapshotCount}`);
  console.log(`  Snapshots with allocation rows: ${allocationSnapshotCount.length}`);

  const holdingsCount = await prisma.holdingsSnapshot.count();
  const holdingSnapshotCount = await prisma.snapshotHolding.groupBy({
    by: ["snapshotId"],
  });
  console.log(`  HoldingsSnapshots: ${holdingsCount}`);
  console.log(`  Snapshots with holding rows: ${holdingSnapshotCount.length}`);
}

async function main(): Promise<void> {
  console.log("Starting JSON → relational data migration\n");

  const tokenMap = await buildTokenMap();
  console.log(`Loaded ${tokenMap.size} tokens for mint → tokenId resolution\n`);

  await migrateAllocations(tokenMap);
  await migrateHoldings(tokenMap);
  await verify();

  console.log("\nMigration complete!");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
