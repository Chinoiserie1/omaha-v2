import { prisma } from "@repo/database";

async function seedVaults(): Promise<void> {
  console.log("Seeding vaults...");

  // Upsert KOL
  const kol = await prisma.kol.upsert({
    where: { username: "SBC7H7La" },
    update: { hasTwitter: false },
    create: { username: "SBC7H7La", hasTwitter: false },
  });
  console.log(`  Upserted KOL: ${kol.username} (${kol.id})`);

  // Upsert vault
  const vault = await prisma.kolVault.upsert({
    where: { kolId: kol.id },
    update: {
      kolUsername: "SBC7H7La",
      name: "SBC7H7La Vault",
      description:
        "Bitcoin-focused trading strategies informed by macro analysis and on-chain data.",
      glamVaultPda: "D8gNHPbPvsgTfqh3Rwjc9cEevPTz8MzESekszZN23QGP",
    },
    create: {
      kolId: kol.id,
      kolUsername: "SBC7H7La",
      name: "SBC7H7La Vault",
      description:
        "Bitcoin-focused trading strategies informed by macro analysis and on-chain data.",
      statePda: "3A3wmPRdEnMUQ8Za5nVL9KNqJhSFiAUghnqrWp2HTi83",
      glamVaultPda: "D8gNHPbPvsgTfqh3Rwjc9cEevPTz8MzESekszZN23QGP",
      vaultName: "SBC7H7La",
      vaultSymbol: "SBC",
    },
  });
  console.log(`  Upserted vault: ${vault.name} (${vault.id})`);

  console.log("Seed vaults completed.");
}

seedVaults()
  .catch((error) => {
    console.error("Seed vaults failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
