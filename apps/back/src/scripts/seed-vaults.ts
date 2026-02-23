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

  // Upsert mert KOL
  const mertKol = await prisma.kol.upsert({
    where: { username: "mert" },
    update: { hasTwitter: true },
    create: { username: "mert", hasTwitter: true },
  });
  console.log(`  Upserted KOL: ${mertKol.username} (${mertKol.id})`);

  // Upsert mert vault
  const mertVault = await prisma.kolVault.upsert({
    where: { kolId: mertKol.id },
    update: {
      kolUsername: "mert",
      name: "mert Vault",
      description:
        "Crypto-native trading strategies by mert.",
      glamVaultPda: "ABhUh47ATwrrgD7gUA1AK9g9jGkXp47BcB6Uhs2bF8hQ",
      jupiterEnabled: true,
      dryRun: true,
    },
    create: {
      kolId: mertKol.id,
      kolUsername: "mert",
      name: "mert Vault",
      description:
        "Crypto-native trading strategies by mert.",
      statePda: "5jdMWiou4AVzev5HZgsuzpcU8jGW9wztenko5sDVpULX",
      glamVaultPda: "ABhUh47ATwrrgD7gUA1AK9g9jGkXp47BcB6Uhs2bF8hQ",
      vaultName: "mert",
      vaultSymbol: "MERT",
      jupiterEnabled: true,
      dryRun: true,
    },
  });
  console.log(`  Upserted vault: ${mertVault.name} (${mertVault.id})`);

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
