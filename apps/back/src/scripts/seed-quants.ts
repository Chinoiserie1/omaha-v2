import { prisma } from "@repo/database";
import type { Prisma } from "@repo/database";

const QUANTS: { username: string; hasTwitter?: boolean; knowledge?: Prisma.InputJsonValue }[] = [
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
  console.log(`Seeding ${QUANTS.length} Quants...`);

  for (const quant of QUANTS) {
    let user = await prisma.user.findFirst({
      where: { twitterUsername: quant.username },
    });
    if (user) {
      if (quant.hasTwitter !== undefined) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { hasTwitter: quant.hasTwitter },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          twitterUsername: quant.username,
          hasTwitter: quant.hasTwitter ?? true,
          userType: "PLACEHOLDER",
        },
      });
    }

    const updateData: Prisma.QuantUpdateInput = {};
    if (quant.knowledge !== undefined) updateData.knowledge = quant.knowledge;

    const result = await prisma.quant.upsert({
      where: { userId: user.id },
      update: updateData,
      create: {
        userId: user.id,
        ...(quant.knowledge !== undefined ? { knowledge: quant.knowledge } : {}),
      },
    });

    console.log(`  Upserted: ${quant.username} (quant: ${result.id})`);
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
