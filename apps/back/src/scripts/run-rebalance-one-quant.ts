import { prisma } from "@repo/database";
import { PublicKey } from "@solana/web3.js";
import { getVaultHoldings } from "../solana/vault-holdings.js";
import { getActiveTokensMap } from "../services/jupiter.service.js";
import { rebalanceVault } from "../services/rebalancer.service.js";

const username = process.argv[2];

if (!username) {
  console.error("Usage: tsx src/scripts/run-rebalance-one-quant.ts <username>");
  process.exit(1);
}

async function run(): Promise<void> {
  // 1. Find quant
  const quant = await prisma.quant.findFirst({
    where: { user: { twitterUsername: username! } },
    include: { user: true },
  });
  if (!quant) {
    console.error(`Quant "${username}" not found`);
    process.exit(1);
  }

  console.info(`\nQuant: ${quant.user.twitterUsername} (${quant.id})`);

  // 2. Find vault
  const vault = await prisma.vault.findUnique({ where: { quantId: quant.id } });
  if (!vault) {
    console.error("No vault found for this Quant");
    process.exit(1);
  }

  console.info(`Vault: ${vault.vaultName} (${vault.statePda})`);
  console.info(`  dryRun: ${vault.dryRun}`);
  console.info(`  isActive: ${vault.isActive}`);
  console.info(`  REBALANCE_DRY_RUN env: ${process.env["REBALANCE_DRY_RUN"] ?? "(not set)"}`);

  // 3. Pre-flight: fetch and display current on-chain holdings
  console.info("\n── Pre-flight: On-chain holdings ──");
  const statePda = new PublicKey(vault.statePda);
  const { holdings, totalEquityUsd } = await getVaultHoldings(statePda);

  // Enrich symbols from Token DB
  const assetsMap = await getActiveTokensMap();
  const mintToSymbol = new Map<string, string>();
  for (const [symbol, v] of assetsMap) mintToSymbol.set(v.mint, symbol);

  for (const h of holdings) {
    const realSymbol = mintToSymbol.get(h.mint);
    if (realSymbol) h.symbol = realSymbol;
  }

  // Sort by value descending
  const sorted = [...holdings].sort((a, b) => b.valueUsd - a.valueUsd);
  for (const h of sorted) {
    const pct = totalEquityUsd > 0 ? ((h.valueUsd / totalEquityUsd) * 100).toFixed(1) : "0.0";
    console.info(
      `  ${h.symbol.padEnd(12)} ${h.uiAmount.toFixed(4).padStart(14)} @ $${h.price.toFixed(4).padStart(10)}  = $${h.valueUsd.toFixed(2).padStart(10)}  (${pct}%)`
    );
  }
  console.info(`  ${"TOTAL".padEnd(12)} ${" ".repeat(14)}   ${" ".repeat(10)}  = $${totalEquityUsd.toFixed(2).padStart(10)}`);

  // 4. Check latest portfolio snapshot
  const snapshot = await prisma.portfolioSnapshot.findFirst({
    where: { quantId: quant.id },
    orderBy: { createdAt: "desc" },
  });
  if (snapshot) {
    const ageH = (Date.now() - snapshot.createdAt.getTime()) / 3600000;
    console.info(`\nLatest snapshot: ${snapshot.createdAt.toISOString()} (${ageH.toFixed(1)}h ago)`);
    const allocs = snapshot.allocations as unknown as { asset: string; percentage: number; mint?: string }[];
    console.info("Target allocations:");
    for (const a of allocs) {
      const deltaUsd = (a.percentage / 100) * totalEquityUsd;
      console.info(`  ${a.asset.padEnd(12)} ${String(a.percentage).padStart(5)}%  → $${deltaUsd.toFixed(2).padStart(8)}  ${a.mint ? a.mint.slice(0, 12) + "..." : "(no mint)"}`);
    }
  } else {
    console.warn("\nNo portfolio snapshot found — rebalance will skip");
  }

  // 5. Run rebalance
  console.info("\n── Running rebalance ──");
  const eventId = await rebalanceVault(quant.id);

  if (eventId) {
    console.info(`\nRebalanceEvent ID: ${eventId}`);
    const event = await prisma.rebalanceEvent.findUnique({ where: { id: eventId } });
    if (event) {
      console.info(`  Status: ${event.status}`);
      console.info(`  Vault equity: $${event.vaultEquityUsd?.toFixed(2)}`);
    }
  } else {
    console.info("\nNo rebalance executed (returned null — check logs above)");
  }
}

run()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
