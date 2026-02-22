import { prisma } from "@repo/database";

const KOLS = [
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
];

async function seed(): Promise<void> {
  console.log(`Seeding ${KOLS.length} KOLs...`);

  for (const kol of KOLS) {
    const result = await prisma.kol.upsert({
      where: { username: kol.username },
      update: {},
      create: { username: kol.username },
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
