import { prisma } from "@repo/database";

interface VaultSeed {
  kolUsername: string;
  hasTwitter: boolean;
  vaultName: string;
  vaultSymbol: string;
  name: string;
  description: string;
  about: string;
  dataSource: string;
  performanceCalc: string;
  disclosure: string;
  statePda: string;
  glamVaultPda: string;
  mintAddress: string | null;
  jupiterEnabled: boolean;
  dryRun: boolean;
}

const VAULTS: VaultSeed[] = [
  {
    kolUsername: "SBC7H7La",
    hasTwitter: false,
    vaultName: "SBC7H7La",
    vaultSymbol: "SBC",
    name: "SBC7H7La Vault",
    description:
      "Bitcoin-focused trading strategies informed by macro analysis and on-chain data.",
    about:
      "This vault follows a Bitcoin-focused strategy driven by macro analysis, on-chain metrics, and sentiment signals. The AI agent monitors the KOL's public commentary and translates their conviction into portfolio allocations across BTC and correlated assets. Rebalancing occurs automatically when new signals are detected.",
    dataSource:
      "Portfolio positions are derived from the KOL's public tweets and on-chain wallet activity. The AI pipeline classifies each tweet for asset mentions, sentiment, and conviction level, then maps those signals to target allocations. On-chain data is fetched directly from Solana via RPC.",
    performanceCalc:
      "Vault performance is calculated from the share token price over time. The share price reflects the net asset value (NAV) of the vault divided by total shares outstanding. Price history is recorded at regular intervals and displayed as percentage change over the selected period.",
    disclosure:
      "This vault is experimental and provided as-is. Past performance does not guarantee future results. The vault is managed by an AI agent and may execute trades based on publicly available social signals that could be inaccurate or misinterpreted. You may lose some or all of your deposited funds. Only invest what you can afford to lose.",
    statePda: "3A3wmPRdEnMUQ8Za5nVL9KNqJhSFiAUghnqrWp2HTi83",
    glamVaultPda: "D8gNHPbPvsgTfqh3Rwjc9cEevPTz8MzESekszZN23QGP",
    mintAddress: null,
    jupiterEnabled: false,
    dryRun: true,
  },
  {
    kolUsername: "mert",
    hasTwitter: true,
    vaultName: "Mert",
    vaultSymbol: "MERT",
    name: "Mert Vault",
    description:
      "Trading strategies curated by Mert, focused on Solana ecosystem insights.",
    about:
      "This vault mirrors the trading thesis of Mert, a well-known voice in the Solana ecosystem. The AI agent analyzes Mert's public posts to extract asset mentions and conviction levels, then constructs a portfolio of Solana-native tokens weighted by signal strength. The vault rebalances automatically when new positions or conviction changes are detected.",
    dataSource:
      "Portfolio positions are derived from the KOL's public tweets and on-chain wallet activity. The AI pipeline classifies each tweet for asset mentions, sentiment, and conviction level, then maps those signals to target allocations. On-chain data is fetched directly from Solana via RPC.",
    performanceCalc:
      "Vault performance is calculated from the share token price over time. The share price reflects the net asset value (NAV) of the vault divided by total shares outstanding. Price history is recorded at regular intervals and displayed as percentage change over the selected period.",
    disclosure:
      "This vault is experimental and provided as-is. Past performance does not guarantee future results. The vault is managed by an AI agent and may execute trades based on publicly available social signals that could be inaccurate or misinterpreted. You may lose some or all of your deposited funds. Only invest what you can afford to lose.",
    statePda: "5jdMWiou4AVzev5HZgsuzpcU8jGW9wztenko5sDVpULX",
    glamVaultPda: "ABhUh47ATwrrgD7gUA1AK9g9jGkXp47BcB6Uhs2bF8hQ",
    mintAddress: null,
    jupiterEnabled: true,
    dryRun: true,
  },
];

async function seedVaults(): Promise<void> {
  console.log(`Seeding ${VAULTS.length} vaults...`);

  for (const v of VAULTS) {
    // Upsert KOL
    const kol = await prisma.kol.upsert({
      where: { username: v.kolUsername },
      update: { hasTwitter: v.hasTwitter },
      create: { username: v.kolUsername, hasTwitter: v.hasTwitter },
    });
    console.log(`  Upserted KOL: ${kol.username} (${kol.id})`);

    // Check if vault already exists
    const existing = await prisma.kolVault.findUnique({
      where: { kolId: kol.id },
    });

    if (existing) {
      console.log(
        `  Vault already exists: ${existing.name} (${existing.id}) — updating`,
      );
    }

    // Upsert vault
    const vault = await prisma.kolVault.upsert({
      where: { kolId: kol.id },
      update: {
        kolUsername: v.kolUsername,
        name: v.name,
        description: v.description,
        about: v.about,
        dataSource: v.dataSource,
        performanceCalc: v.performanceCalc,
        disclosure: v.disclosure,
        glamVaultPda: v.glamVaultPda,
        mintAddress: v.mintAddress,
        jupiterEnabled: v.jupiterEnabled,
        dryRun: v.dryRun,
      },
      create: {
        kolId: kol.id,
        kolUsername: v.kolUsername,
        name: v.name,
        description: v.description,
        about: v.about,
        dataSource: v.dataSource,
        performanceCalc: v.performanceCalc,
        disclosure: v.disclosure,
        statePda: v.statePda,
        glamVaultPda: v.glamVaultPda,
        mintAddress: v.mintAddress,
        vaultName: v.vaultName,
        vaultSymbol: v.vaultSymbol,
        jupiterEnabled: v.jupiterEnabled,
        dryRun: v.dryRun,
      },
    });

    const action = existing ? "Updated" : "Created";
    console.log(`  ${action} vault: ${vault.name} (${vault.id})`);
  }

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
      about:
        "This vault mirrors the trading thesis of Mert, a well-known voice in the Solana ecosystem. The AI agent analyzes Mert's public posts to extract asset mentions and conviction levels, then constructs a portfolio of Solana-native tokens weighted by signal strength. The vault rebalances automatically when new positions or conviction changes are detected.",
      dataSource:
        "Portfolio positions are derived from the KOL's public tweets and on-chain wallet activity. The AI pipeline classifies each tweet for asset mentions, sentiment, and conviction level, then maps those signals to target allocations. On-chain data is fetched directly from Solana via RPC.",
      performanceCalc:
        "Vault performance is calculated from the share token price over time. The share price reflects the net asset value (NAV) of the vault divided by total shares outstanding. Price history is recorded at regular intervals and displayed as percentage change over the selected period.",
      disclosure:
        "This vault is experimental and provided as-is. Past performance does not guarantee future results. The vault is managed by an AI agent and may execute trades based on publicly available social signals that could be inaccurate or misinterpreted. You may lose some or all of your deposited funds. Only invest what you can afford to lose.",
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
      about:
        "This vault mirrors the trading thesis of Mert, a well-known voice in the Solana ecosystem. The AI agent analyzes Mert's public posts to extract asset mentions and conviction levels, then constructs a portfolio of Solana-native tokens weighted by signal strength. The vault rebalances automatically when new positions or conviction changes are detected.",
      dataSource:
        "Portfolio positions are derived from the KOL's public tweets and on-chain wallet activity. The AI pipeline classifies each tweet for asset mentions, sentiment, and conviction level, then maps those signals to target allocations. On-chain data is fetched directly from Solana via RPC.",
      performanceCalc:
        "Vault performance is calculated from the share token price over time. The share price reflects the net asset value (NAV) of the vault divided by total shares outstanding. Price history is recorded at regular intervals and displayed as percentage change over the selected period.",
      disclosure:
        "This vault is experimental and provided as-is. Past performance does not guarantee future results. The vault is managed by an AI agent and may execute trades based on publicly available social signals that could be inaccurate or misinterpreted. You may lose some or all of your deposited funds. Only invest what you can afford to lose.",
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
