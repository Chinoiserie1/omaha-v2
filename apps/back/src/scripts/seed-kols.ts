import { prisma } from "@repo/database";
import type { Prisma } from "@repo/database";

const KOLS: { username: string; hasTwitter?: boolean; knowledge?: Prisma.InputJsonValue }[] = [
  { username: "inversebrah" },
  { username: "colourgrey_" },
  { username: "blknoiz06" },
  { username: "CryptoHayes" },
  { username: "GiganticRebirth" },
  { username: "DefiIgnas" },
  { username: "haborz_" },
  { username: "0xSisyphus" },
  { username: "jonwu_" },
  { username: "mert" },
  { username: "nicovrg_" },
  { username: "QwQiao" },
  { username: "michaeljburry" },
  { username: "naval" },
  { username: "mattytay" },
  { username: "PenisVentures" },
  { username: "LynAldenContact" },
  { username: "jussy_world" },
  { username: "SBC7H7La", hasTwitter: false },
  { username: "Citrini7" },
  { username: "NancyPelosiTracker", hasTwitter: false },
  {
    username: "0domart",
    knowledge: {
      investmentStyle: "Solana-native builder/investor focused on infrastructure and DeFi",
      notes: [
        "BAM mentions = bullish on Jito ecosystem (JTO), not a separate token",
        "Prefers JitoSOL over native SOL for staking yield",
        "Uses PiggyBank for stablecoin yield strategies",
      ],
    },
  },
];

async function seed(): Promise<void> {
  console.log(`Seeding ${KOLS.length} KOLs...`);

  for (const kol of KOLS) {
    const updateData: Prisma.KolUpdateInput = {};
    if (kol.hasTwitter !== undefined) updateData.hasTwitter = kol.hasTwitter;
    if (kol.knowledge !== undefined) updateData.knowledge = kol.knowledge;

    const result = await prisma.kol.upsert({
      where: { username: kol.username },
      update: updateData,
      create: {
        username: kol.username,
        hasTwitter: kol.hasTwitter ?? true,
        ...(kol.knowledge !== undefined ? { knowledge: kol.knowledge } : {}),
      },
    });
    console.log(`  Upserted: ${result.username} (${result.id})`);
  }

  console.log("Seed completed.");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
