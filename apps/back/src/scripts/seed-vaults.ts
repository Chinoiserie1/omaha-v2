import { prisma } from "@repo/database";
import type { Prisma } from "@repo/database";
import type { VaultHoldingWithPct } from "@repo/shared";
import { upsertVaultToken } from "../store/token-price.repository.js";

interface HoldingsSeed {
  holdings: VaultHoldingWithPct[];
  totalEquityUsd: number;
}

interface VaultSeed {
  quantUsername: string;
  hasTwitter: boolean;
  vaultName: string;
  vaultSymbol: string;
  about: string;
  dataSource: string;
  performanceCalc: string;
  disclosure: string;
  statePda: string;
  mintAddress: string | null;
  shareMint?: string;
  dryRun: boolean;
  holdings?: HoldingsSeed;
}

const VAULTS: VaultSeed[] = [
  {
    quantUsername: "SBC7H7La",
    hasTwitter: false,
    vaultName: "SBC7H7La",
    vaultSymbol: "SBC",
    about:
      "This vault follows a Bitcoin-focused strategy driven by macro analysis, on-chain metrics, and sentiment signals. The AI agent monitors the Quant's public commentary and translates their conviction into portfolio allocations across BTC and correlated assets. Rebalancing occurs automatically when new signals are detected.",
    dataSource:
      "Portfolio positions are derived from the Quant's public tweets and on-chain wallet activity. The AI pipeline classifies each tweet for asset mentions, sentiment, and conviction level, then maps those signals to target allocations. On-chain data is fetched directly from Solana via RPC.",
    performanceCalc:
      "Vault performance is calculated from the share token price over time. The share price reflects the net asset value (NAV) of the vault divided by total shares outstanding. Price history is recorded at regular intervals and displayed as percentage change over the selected period.",
    disclosure:
      "This vault is experimental and provided as-is. Past performance does not guarantee future results. The vault is managed by an AI agent and may execute trades based on publicly available social signals that could be inaccurate or misinterpreted. You may lose some or all of your deposited funds. Only invest what you can afford to lose.",
    statePda: "3A3wmPRdEnMUQ8Za5nVL9KNqJhSFiAUghnqrWp2HTi83",
    mintAddress: null,
    dryRun: true,
    holdings: {
      holdings: [
        {
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          uiAmount: 50.5,
          price: 145.2,
          valueUsd: 7332.6,
          percentage: 60.0,
        },
        {
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          symbol: "USDC",
          uiAmount: 4888.4,
          price: 1.0,
          valueUsd: 4888.4,
          percentage: 40.0,
        },
      ],
      totalEquityUsd: 12221.0,
    },
  },
  {
    quantUsername: "mert",
    hasTwitter: true,
    vaultName: "Mert",
    vaultSymbol: "oMERT",
    about:
      "This vault mirrors the trading thesis of Mert, a well-known voice in the Solana ecosystem. The AI agent analyzes Mert's public posts to extract asset mentions and conviction levels, then constructs a portfolio of Solana-native tokens weighted by signal strength. The vault rebalances automatically when new positions or conviction changes are detected.",
    dataSource:
      "Portfolio positions are derived from the Quant's public tweets and on-chain wallet activity. The AI pipeline classifies each tweet for asset mentions, sentiment, and conviction level, then maps those signals to target allocations. On-chain data is fetched directly from Solana via RPC.",
    performanceCalc:
      "Vault performance is calculated from the share token price over time. The share price reflects the net asset value (NAV) of the vault divided by total shares outstanding. Price history is recorded at regular intervals and displayed as percentage change over the selected period.",
    disclosure:
      "This vault is experimental and provided as-is. Past performance does not guarantee future results. The vault is managed by an AI agent and may execute trades based on publicly available social signals that could be inaccurate or misinterpreted. You may lose some or all of your deposited funds. Only invest what you can afford to lose.",
    statePda: "GCpt7MoHjjgF13X8ekKw79rEvo1EhKPzBtQ6nXXQbp4N",
    mintAddress: null,
    shareMint: "HGtLrjgTMmeFAnm1oD3BgoccvzKGbTo4g9AujvVnvsyJ",
    dryRun: false,
    holdings: {
      holdings: [
        {
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          uiAmount: 120.0,
          price: 145.2,
          valueUsd: 17424.0,
          percentage: 45.0,
        },
        {
          mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
          symbol: "JUP",
          uiAmount: 8500.0,
          price: 1.05,
          valueUsd: 8925.0,
          percentage: 23.1,
        },
        {
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          symbol: "USDC",
          uiAmount: 12371.0,
          price: 1.0,
          valueUsd: 12371.0,
          percentage: 31.9,
        },
      ],
      totalEquityUsd: 38720.0,
    },
  },
];

async function seedVaults(): Promise<void> {
  console.log(`Seeding ${VAULTS.length} vaults...`);

  for (const v of VAULTS) {
    // Find or create User + Quant
    let vUser = await prisma.user.findFirst({
      where: { twitterUsername: v.quantUsername },
    });
    if (vUser) {
      vUser = await prisma.user.update({
        where: { id: vUser.id },
        data: { hasTwitter: v.hasTwitter },
      });
    } else {
      vUser = await prisma.user.create({
        data: {
          twitterUsername: v.quantUsername,
          hasTwitter: v.hasTwitter,
          userType: "PLACEHOLDER",
        },
      });
    }
    const quant = await prisma.quant.upsert({
      where: { userId: vUser.id },
      update: {},
      create: { userId: vUser.id },
    });
    console.log(`  Upserted Quant: ${vUser.twitterUsername} (${quant.id})`);

    // Check if vault already exists
    const existing = await prisma.vault.findUnique({
      where: { quantId: quant.id },
    });

    if (existing) {
      console.log(
        `  Vault already exists: ${existing.vaultName} (${existing.id}) — updating`,
      );
    }

    // Upsert vault
    const vault = await prisma.vault.upsert({
      where: { quantId: quant.id },
      update: {
        about: v.about,
        dataSource: v.dataSource,
        performanceCalc: v.performanceCalc,
        disclosure: v.disclosure,
        statePda: v.statePda,
        mintAddress: v.mintAddress,
        shareMint: v.shareMint ?? null,
        vaultName: v.vaultName,
        vaultSymbol: v.vaultSymbol,
        dryRun: v.dryRun,
      },
      create: {
        quantId: quant.id,
        about: v.about,
        dataSource: v.dataSource,
        performanceCalc: v.performanceCalc,
        disclosure: v.disclosure,
        statePda: v.statePda,
        mintAddress: v.mintAddress,
        shareMint: v.shareMint ?? null,
        vaultName: v.vaultName,
        vaultSymbol: v.vaultSymbol,
        dryRun: v.dryRun,
      },
    });

    const action = existing ? "Updated" : "Created";
    console.log(`  ${action} vault: ${vault.vaultName} (${vault.id})`);

    // Create Token record for vaults with shareMint
    if (v.shareMint) {
      await upsertVaultToken({
        name: v.vaultName,
        symbol: v.vaultSymbol,
        decimals: 9,
        mint: v.shareMint,
        vaultId: vault.id,
      });
      console.log(`  Upserted share mint token: ${v.shareMint}`);
    }

    // Seed holdings snapshot
    if (v.holdings) {
      const existingSnapshot = await prisma.holdingsSnapshot.findFirst({
        where: { vaultId: vault.id, endDate: null },
      });

      if (existingSnapshot) {
        console.log(`  Holdings snapshot already exists for ${vault.vaultName} — skipping`);
      } else {
        await prisma.holdingsSnapshot.create({
          data: {
            vaultId: vault.id,
            holdings: v.holdings.holdings as unknown as Prisma.InputJsonValue,
            totalEquityUsd: v.holdings.totalEquityUsd,
          },
        });
        console.log(`  Created holdings snapshot for ${vault.vaultName}`);
      }
    }
  }

  // ── Seed rebalance events with full chain: Tweet → PortfolioSnapshot → TweetImpact → RebalanceEvent ──

  await seedRebalanceData();

  console.log("Seed vaults completed.");
}

interface RebalanceSeed {
  quantUsername: string;
  tweets: {
    tweetId: string;
    fullText: string;
    postedAt: Date;
    favoriteCount: number;
    retweetCount: number;
    replyCount: number;
    bookmarkCount: number;
    viewsCount: number;
    isRetweet: boolean;
    isReply: boolean;
    isThread: boolean;
    conversationId: string | null;
    source: string;
    sourceUrl: string | null;
  }[];
  snapshots: {
    thesisSummary: string;
    allocations: Prisma.InputJsonValue;
    changes: string[];
    sourceTweetIds: string[];
    impacts: {
      tweetIdRef: string;
      assets: string[];
      impactType: string;
      allocationDelta: number;
      conviction: string;
      sentiment: string;
      category: string;
      engagementScore: number;
      significanceScore: number;
    }[];
    rebalance: {
      status: string;
      sellCount: number;
      buyCount: number;
      totalSwaps: number;
      swapDetails: Prisma.InputJsonValue;
      vaultEquityUsd: number;
      errorMessage: string | null;
      startedAt: Date;
      completedAt: Date | null;
    };
  }[];
}

const REBALANCE_SEEDS: RebalanceSeed[] = [
  {
    quantUsername: "SBC7H7La",
    tweets: [
      {
        tweetId: "seed_sbc_tweet_001",
        fullText:
          "BTC breaking above 95k with massive volume. This is the confirmation we needed — the macro backdrop with rate cuts and ETF inflows is aligning perfectly. Adding to my position here. $BTC",
        postedAt: new Date("2026-02-28T14:30:00Z"),
        favoriteCount: 4200,
        retweetCount: 890,
        replyCount: 310,
        bookmarkCount: 520,
        viewsCount: 185000,
        isRetweet: false,
        isReply: false,
        isThread: false,
        conversationId: null,
        source: "twitter",
        sourceUrl: "https://x.com/SBC7H7La/status/seed_sbc_tweet_001",
      },
      {
        tweetId: "seed_sbc_tweet_002",
        fullText:
          "SOL showing incredible strength relative to ETH this cycle. The Firedancer upgrade is a catalyst most people are sleeping on. Rotating some USDC into SOL here. $SOL",
        postedAt: new Date("2026-03-01T09:15:00Z"),
        favoriteCount: 3100,
        retweetCount: 670,
        replyCount: 245,
        bookmarkCount: 410,
        viewsCount: 142000,
        isRetweet: false,
        isReply: false,
        isThread: false,
        conversationId: null,
        source: "twitter",
        sourceUrl: "https://x.com/SBC7H7La/status/seed_sbc_tweet_002",
      },
      {
        tweetId: "seed_sbc_tweet_003",
        fullText:
          "Trimming some BTC exposure here after the 10% run. Taking profits into USDC. Will re-enter on a pullback to 90k support. Risk management > conviction. $BTC $USDC",
        postedAt: new Date("2026-03-02T16:45:00Z"),
        favoriteCount: 2800,
        retweetCount: 540,
        replyCount: 198,
        bookmarkCount: 380,
        viewsCount: 128000,
        isRetweet: false,
        isReply: false,
        isThread: true,
        conversationId: "seed_sbc_conv_003",
        source: "twitter",
        sourceUrl: "https://x.com/SBC7H7La/status/seed_sbc_tweet_003",
      },
    ],
    snapshots: [
      {
        thesisSummary:
          "Bullish BTC thesis strengthened by ETF inflows and macro tailwinds. Increasing BTC allocation from 40% to 55% while reducing USDC. SOL remains a core hold at 30%.",
        allocations: [
          {
            asset: "BTC",
            mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
            percentage: 55,
            conviction: "high",
            reasoning: "ETF inflows accelerating, macro rate cuts confirmed",
            since: "2026-02-28",
            lastSignal: "2026-02-28",
          },
          {
            asset: "SOL",
            mint: "So11111111111111111111111111111111111111112",
            percentage: 30,
            conviction: "high",
            reasoning: "Firedancer upgrade catalyst, strong relative strength",
            since: "2026-01-15",
            lastSignal: "2026-02-28",
          },
          {
            asset: "USDC",
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            percentage: 15,
            conviction: "low",
            reasoning: "Dry powder for pullback entries",
            since: "2026-01-01",
            lastSignal: "2026-02-28",
          },
        ],
        changes: [
          "Increased BTC allocation from 40% to 55% based on breakout confirmation",
          "Reduced USDC from 30% to 15% — deploying dry powder",
          "SOL position maintained at 30% with high conviction",
        ],
        sourceTweetIds: ["seed_sbc_tweet_001"],
        impacts: [
          {
            tweetIdRef: "seed_sbc_tweet_001",
            assets: ["BTC"],
            impactType: "increase",
            allocationDelta: 15.0,
            conviction: "high",
            sentiment: "bullish",
            category: "macro_analysis",
            engagementScore: 82.5,
            significanceScore: 9.2,
          },
        ],
        rebalance: {
          status: "COMPLETED",
          sellCount: 1,
          buyCount: 1,
          totalSwaps: 2,
          swapDetails: [
            {
              asset: "USDC",
              mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
              direction: "sell",
              currentPct: 30,
              targetPct: 15,
              deltaPct: -15,
              deltaUsd: -1833.15,
              txSig: "5xFake1SellSigUsdcToSol123abc456def789",
            },
            {
              asset: "BTC",
              mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
              direction: "buy",
              currentPct: 40,
              targetPct: 55,
              deltaPct: 15,
              deltaUsd: 1833.15,
              txSig: "5xFake1BuySigBtcFromUsdc123abc456def789",
            },
          ],
          vaultEquityUsd: 12221.0,
          errorMessage: null,
          startedAt: new Date("2026-02-28T15:00:00Z"),
          completedAt: new Date("2026-02-28T15:02:30Z"),
        },
      },
      {
        thesisSummary:
          "Rotating SOL higher after Firedancer news. BTC trimmed slightly after 10% run-up. Maintaining risk management with 20% USDC buffer.",
        allocations: [
          {
            asset: "SOL",
            mint: "So11111111111111111111111111111111111111112",
            percentage: 40,
            conviction: "high",
            reasoning: "Firedancer upgrade imminent, relative strength vs ETH",
            since: "2026-01-15",
            lastSignal: "2026-03-01",
          },
          {
            asset: "BTC",
            mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
            percentage: 40,
            conviction: "medium",
            reasoning: "Trimmed after 10% run, waiting for pullback to 90k",
            since: "2026-02-28",
            lastSignal: "2026-03-02",
          },
          {
            asset: "USDC",
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            percentage: 20,
            conviction: "low",
            reasoning: "Increased buffer for re-entry on BTC pullback",
            since: "2026-01-01",
            lastSignal: "2026-03-02",
          },
        ],
        changes: [
          "SOL increased from 30% to 40% on Firedancer catalyst",
          "BTC trimmed from 55% to 40% — taking profits after 10% move",
          "USDC buffer raised to 20% for pullback re-entry",
        ],
        sourceTweetIds: ["seed_sbc_tweet_002", "seed_sbc_tweet_003"],
        impacts: [
          {
            tweetIdRef: "seed_sbc_tweet_002",
            assets: ["SOL"],
            impactType: "increase",
            allocationDelta: 10.0,
            conviction: "high",
            sentiment: "bullish",
            category: "technical_analysis",
            engagementScore: 71.3,
            significanceScore: 8.5,
          },
          {
            tweetIdRef: "seed_sbc_tweet_003",
            assets: ["BTC", "USDC"],
            impactType: "decrease",
            allocationDelta: -15.0,
            conviction: "medium",
            sentiment: "neutral",
            category: "risk_management",
            engagementScore: 65.8,
            significanceScore: 7.1,
          },
        ],
        rebalance: {
          status: "COMPLETED",
          sellCount: 1,
          buyCount: 1,
          totalSwaps: 2,
          swapDetails: [
            {
              asset: "BTC",
              mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
              direction: "sell",
              currentPct: 55,
              targetPct: 40,
              deltaPct: -15,
              deltaUsd: -1833.15,
              txSig: "5xFake2SellSigBtcToUsdc987zyx654wvu321",
            },
            {
              asset: "SOL",
              mint: "So11111111111111111111111111111111111111112",
              direction: "buy",
              currentPct: 30,
              targetPct: 40,
              deltaPct: 10,
              deltaUsd: 1222.1,
              txSig: "5xFake2BuySigSolFromUsdc987zyx654wvu321",
            },
          ],
          vaultEquityUsd: 13150.0,
          errorMessage: null,
          startedAt: new Date("2026-03-02T17:00:00Z"),
          completedAt: new Date("2026-03-02T17:03:15Z"),
        },
      },
    ],
  },
  {
    quantUsername: "mert",
    tweets: [
      {
        tweetId: "seed_mert_tweet_001",
        fullText:
          "JUP is insanely undervalued at these levels. The revenue share model + perpetuals launch makes this a no-brainer. Loading up more here. $JUP",
        postedAt: new Date("2026-02-27T11:00:00Z"),
        favoriteCount: 8500,
        retweetCount: 2100,
        replyCount: 780,
        bookmarkCount: 1200,
        viewsCount: 420000,
        isRetweet: false,
        isReply: false,
        isThread: false,
        conversationId: null,
        source: "twitter",
        sourceUrl: "https://x.com/maboroshi_mert/status/seed_mert_tweet_001",
      },
      {
        tweetId: "seed_mert_tweet_002",
        fullText:
          "Solana TPS hitting new ATHs post-Firedancer testnet. The throughput improvement is real — 10x what we had 6 months ago. $SOL will reprice. Adding more SOL and trimming stables.",
        postedAt: new Date("2026-03-01T15:30:00Z"),
        favoriteCount: 12000,
        retweetCount: 3400,
        replyCount: 920,
        bookmarkCount: 1800,
        viewsCount: 680000,
        isRetweet: false,
        isReply: false,
        isThread: true,
        conversationId: "seed_mert_conv_002",
        source: "twitter",
        sourceUrl: "https://x.com/maboroshi_mert/status/seed_mert_tweet_002",
      },
      {
        tweetId: "seed_mert_tweet_003",
        fullText:
          "Bonk integration with Jupiter is actually huge for memecoins on Solana. The liquidity routing is seamless now. Small position in BONK as a high-beta play. $BONK $SOL",
        postedAt: new Date("2026-03-02T20:00:00Z"),
        favoriteCount: 6200,
        retweetCount: 1500,
        replyCount: 540,
        bookmarkCount: 890,
        viewsCount: 310000,
        isRetweet: false,
        isReply: false,
        isThread: false,
        conversationId: null,
        source: "twitter",
        sourceUrl: "https://x.com/maboroshi_mert/status/seed_mert_tweet_003",
      },
    ],
    snapshots: [
      {
        thesisSummary:
          "Heavy Solana ecosystem allocation. JUP fundamentals strongest in DeFi — revenue share + perpetuals launch. SOL remains core conviction hold. Reducing stables to 20%.",
        allocations: [
          {
            asset: "SOL",
            mint: "So11111111111111111111111111111111111111112",
            percentage: 45,
            conviction: "high",
            reasoning: "Firedancer testnet exceeding expectations, ecosystem growth",
            since: "2026-01-01",
            lastSignal: "2026-02-27",
          },
          {
            asset: "JUP",
            mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
            percentage: 35,
            conviction: "high",
            reasoning: "Revenue share model + perpetuals launch imminent",
            since: "2026-02-01",
            lastSignal: "2026-02-27",
          },
          {
            asset: "USDC",
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            percentage: 20,
            conviction: "low",
            reasoning: "Minimal dry powder — high conviction in current positions",
            since: "2026-01-01",
            lastSignal: "2026-02-27",
          },
        ],
        changes: [
          "JUP allocation increased from 23% to 35% on perpetuals catalyst",
          "USDC reduced from 32% to 20% — deploying capital into JUP",
          "SOL maintained at 45% with highest conviction",
        ],
        sourceTweetIds: ["seed_mert_tweet_001"],
        impacts: [
          {
            tweetIdRef: "seed_mert_tweet_001",
            assets: ["JUP"],
            impactType: "increase",
            allocationDelta: 12.0,
            conviction: "high",
            sentiment: "bullish",
            category: "fundamental_analysis",
            engagementScore: 91.2,
            significanceScore: 9.5,
          },
        ],
        rebalance: {
          status: "COMPLETED",
          sellCount: 1,
          buyCount: 1,
          totalSwaps: 2,
          swapDetails: [
            {
              asset: "USDC",
              mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
              direction: "sell",
              currentPct: 32,
              targetPct: 20,
              deltaPct: -12,
              deltaUsd: -4646.4,
              txSig: "5xFake3SellUsdcForJup111aaa222bbb333ccc",
            },
            {
              asset: "JUP",
              mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
              direction: "buy",
              currentPct: 23,
              targetPct: 35,
              deltaPct: 12,
              deltaUsd: 4646.4,
              txSig: "5xFake3BuyJupFromUsdc111aaa222bbb333ccc",
            },
          ],
          vaultEquityUsd: 38720.0,
          errorMessage: null,
          startedAt: new Date("2026-02-27T12:00:00Z"),
          completedAt: new Date("2026-02-27T12:04:10Z"),
        },
      },
      {
        thesisSummary:
          "SOL repricing thesis confirmed by Firedancer testnet results. Increasing SOL to 50%. Adding small BONK position as high-beta Solana play. JUP maintained at 30%.",
        allocations: [
          {
            asset: "SOL",
            mint: "So11111111111111111111111111111111111111112",
            percentage: 50,
            conviction: "high",
            reasoning: "Firedancer TPS records, ecosystem dominance accelerating",
            since: "2026-01-01",
            lastSignal: "2026-03-01",
          },
          {
            asset: "JUP",
            mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
            percentage: 30,
            conviction: "high",
            reasoning: "Perpetuals live, revenue share active",
            since: "2026-02-01",
            lastSignal: "2026-03-01",
          },
          {
            asset: "BONK",
            mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
            percentage: 5,
            conviction: "medium",
            reasoning: "High-beta Solana memecoin with Jupiter integration",
            since: "2026-03-02",
            lastSignal: "2026-03-02",
          },
          {
            asset: "USDC",
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            percentage: 15,
            conviction: "low",
            reasoning: "Minimal buffer — deploying into SOL and BONK",
            since: "2026-01-01",
            lastSignal: "2026-03-02",
          },
        ],
        changes: [
          "SOL increased from 45% to 50% on Firedancer TPS records",
          "New BONK position at 5% — high-beta Solana memecoin play",
          "JUP trimmed from 35% to 30% to fund new positions",
          "USDC reduced from 20% to 15%",
        ],
        sourceTweetIds: ["seed_mert_tweet_002", "seed_mert_tweet_003"],
        impacts: [
          {
            tweetIdRef: "seed_mert_tweet_002",
            assets: ["SOL"],
            impactType: "increase",
            allocationDelta: 5.0,
            conviction: "high",
            sentiment: "bullish",
            category: "technical_analysis",
            engagementScore: 95.0,
            significanceScore: 9.8,
          },
          {
            tweetIdRef: "seed_mert_tweet_003",
            assets: ["BONK", "SOL"],
            impactType: "new_position",
            allocationDelta: 5.0,
            conviction: "medium",
            sentiment: "bullish",
            category: "ecosystem_analysis",
            engagementScore: 78.4,
            significanceScore: 7.3,
          },
        ],
        rebalance: {
          status: "COMPLETED",
          sellCount: 2,
          buyCount: 2,
          totalSwaps: 4,
          swapDetails: [
            {
              asset: "JUP",
              mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
              direction: "sell",
              currentPct: 35,
              targetPct: 30,
              deltaPct: -5,
              deltaUsd: -2030.0,
              txSig: "5xFake4SellJupToUsdc444ddd555eee666fff",
            },
            {
              asset: "USDC",
              mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
              direction: "sell",
              currentPct: 20,
              targetPct: 15,
              deltaPct: -5,
              deltaUsd: -2030.0,
              txSig: "5xFake4SellUsdcToSol444ddd555eee666fff",
            },
            {
              asset: "SOL",
              mint: "So11111111111111111111111111111111111111112",
              direction: "buy",
              currentPct: 45,
              targetPct: 50,
              deltaPct: 5,
              deltaUsd: 2030.0,
              txSig: "5xFake4BuySolFromUsdc444ddd555eee666fff",
            },
            {
              asset: "BONK",
              mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
              direction: "buy",
              currentPct: 0,
              targetPct: 5,
              deltaPct: 5,
              deltaUsd: 2030.0,
              txSig: "5xFake4BuyBonkFromUsdc444ddd555eee666fff",
            },
          ],
          vaultEquityUsd: 40600.0,
          errorMessage: null,
          startedAt: new Date("2026-03-02T21:00:00Z"),
          completedAt: new Date("2026-03-02T21:05:45Z"),
        },
      },
    ],
  },
];

async function seedRebalanceData(): Promise<void> {
  console.log("\nSeeding rebalance data...");

  for (const seed of REBALANCE_SEEDS) {
    const quant = await prisma.quant.findFirst({
      where: { user: { twitterUsername: seed.quantUsername } },
    });
    if (!quant) {
      console.log(`  Quant ${seed.quantUsername} not found — skipping`);
      continue;
    }

    const vault = await prisma.vault.findUnique({
      where: { quantId: quant.id },
    });
    if (!vault) {
      console.log(`  Vault for ${seed.quantUsername} not found — skipping`);
      continue;
    }

    // Check if rebalance data already seeded
    const existingEvents = await prisma.rebalanceEvent.findFirst({
      where: { vaultId: vault.id },
    });
    if (existingEvents) {
      console.log(`  Rebalance data already exists for ${seed.quantUsername} — skipping`);
      continue;
    }

    // Upsert tweets
    const tweetIdMap = new Map<string, string>();
    for (const t of seed.tweets) {
      const tweet = await prisma.tweet.upsert({
        where: { tweetId: t.tweetId },
        update: {},
        create: {
          tweetId: t.tweetId,
          quantId: quant.id,
          fullText: t.fullText,
          postedAt: t.postedAt,
          favoriteCount: t.favoriteCount,
          retweetCount: t.retweetCount,
          replyCount: t.replyCount,
          bookmarkCount: t.bookmarkCount,
          viewsCount: t.viewsCount,
          isRetweet: t.isRetweet,
          isReply: t.isReply,
          isThread: t.isThread,
          conversationId: t.conversationId,
          source: t.source,
          sourceUrl: t.sourceUrl,
        },
      });
      tweetIdMap.set(t.tweetId, tweet.id);
      console.log(`  Upserted tweet: ${t.tweetId.slice(0, 30)}...`);
    }

    // Create snapshots → tweet impacts → rebalance events
    for (const snap of seed.snapshots) {
      const sourceTweetDbIds = snap.sourceTweetIds.map(
        (refId) => tweetIdMap.get(refId)!,
      );

      const snapshot = await prisma.portfolioSnapshot.create({
        data: {
          quantId: quant.id,
          thesisSummary: snap.thesisSummary,
          allocations: snap.allocations,
          changes: snap.changes,
          sourceTweetIds: sourceTweetDbIds,
        },
      });
      console.log(`  Created snapshot: ${snapshot.id}`);

      // Create tweet impacts
      for (const impact of snap.impacts) {
        const tweetDbId = tweetIdMap.get(impact.tweetIdRef);
        if (!tweetDbId) {
          console.log(`  Tweet ref ${impact.tweetIdRef} not found — skipping impact`);
          continue;
        }

        await prisma.tweetImpact.create({
          data: {
            tweetId: tweetDbId,
            quantId: quant.id,
            snapshotId: snapshot.id,
            assets: impact.assets,
            impactType: impact.impactType,
            allocationDelta: impact.allocationDelta,
            conviction: impact.conviction,
            sentiment: impact.sentiment,
            category: impact.category,
            engagementScore: impact.engagementScore,
            significanceScore: impact.significanceScore,
          },
        });
        console.log(`    Created impact: ${impact.assets.join(", ")} (${impact.impactType})`);
      }

      // Create rebalance event
      const rb = snap.rebalance;
      await prisma.rebalanceEvent.create({
        data: {
          vaultId: vault.id,
          snapshotId: snapshot.id,
          status: rb.status,
          sellCount: rb.sellCount,
          buyCount: rb.buyCount,
          totalSwaps: rb.totalSwaps,
          swapDetails: rb.swapDetails,
          vaultEquityUsd: rb.vaultEquityUsd,
          errorMessage: rb.errorMessage,
          startedAt: rb.startedAt,
          completedAt: rb.completedAt,
        },
      });
      console.log(`    Created rebalance: ${rb.status} (${rb.totalSwaps} swaps, $${rb.vaultEquityUsd})`);
    }

    console.log(`  Seeded rebalance data for ${seed.quantUsername}`);
  }

  console.log("Rebalance seed completed.");
}

seedVaults()
  .catch((error) => {
    console.error("Seed vaults failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
