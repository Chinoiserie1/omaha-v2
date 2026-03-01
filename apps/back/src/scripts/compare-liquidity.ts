/**
 * compare-liquidity.ts
 * ════════════════════
 * Compares on-chain liquidity between competing tokens on Solana.
 * Uses TWO independent data sources and produces a composite score.
 *
 * Save this file to: apps/back/scripts/compare-liquidity.ts
 * Run with:          npx tsx scripts/compare-liquidity.ts <mint1> <mint2> [mint3] [mint4]
 *
 * ── EXAMPLES ──────────────────────────────────────────────────────────
 *
 * Dedup wrapped BTC (pick 1 of 4):
 *   npx tsx scripts/compare-liquidity.ts \
 *     21BTCo9hWHjGYYUQQLqjLgDBxjcn8vDt4Zic7TB3UbNE \
 *     cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij \
 *     5XZw2LKTyrfvfiskJ78AMpackRjPcyCif1WhUsPDuVqQ \
 *     zBTCug3er3tLyffELcvDNrKkCymbPWysGcWihESYfLg
 *
 * Dedup gold (pick 1 of 2):
 *   npx tsx scripts/compare-liquidity.ts \
 *     Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re \
 *     <GOLD_MINT>
 *
 * ── ENVIRONMENT VARIABLES ─────────────────────────────────────────────
 *
 *   BIRDEYE_API_KEY  — Required. Get from https://birdeye.so (Settings > API)
 *   JUPITER_API_KEY  — Optional. If set, passed as X-API-Key header to Jupiter.
 *                      Without it, you're on the public rate limit.
 *
 * ── HOW IT WORKS ──────────────────────────────────────────────────────
 *
 * For each token mint, the script collects 3 independent liquidity signals:
 *
 *   SIGNAL 1: Birdeye 24h trading volume (v24hUSD)
 *   ─────────────────────────────────────────────
 *   Higher volume = more trading activity = more liquid.
 *   This is the total USD volume traded across ALL DEX pools in last 24h.
 *
 *   SIGNAL 2: Birdeye liquidity depth (liquidity)
 *   ─────────────────────────────────────────────
 *   This is total value locked (TVL) across all liquidity pools for this token.
 *   Higher TVL = deeper order books = less slippage on large trades.
 *
 *   SIGNAL 3: Jupiter price impact at $10K swap
 *   ────────────────────────────────────────────
 *   We simulate a $10,000 USDC → token swap via Jupiter Ultra API.
 *   Jupiter returns `priceImpactPct` — the % the price moves against you.
 *   Lower (closer to 0) = better liquidity.
 *   Negative values = favorable (you got MORE than expected, usually from RFQ).
 *
 * These 3 signals are normalized across all candidates and combined:
 *
 *   COMPOSITE = 0.4 × volume_score + 0.3 × liquidity_score + 0.3 × impact_score
 *
 * The token with the highest composite score is the WINNER (most liquid).
 *
 * ── API REFERENCE ─────────────────────────────────────────────────────
 *
 * BIRDEYE TOKEN OVERVIEW
 *   Endpoint: GET https://public-api.birdeye.so/defi/token_overview
 *   Params:   ?address=<MINT_ADDRESS>
 *   Headers:  X-API-KEY: <your key>, x-chain: solana
 *   Response: {
 *     success: true,
 *     data: {
 *       symbol: "cbBTC",
 *       name: "Coinbase Wrapped BTC",
 *       price: 84231.45,
 *       v24hUSD: 12500000,        // ← 24h volume in USD (SIGNAL 1)
 *       liquidity: 45000000,      // ← total TVL across pools (SIGNAL 2)
 *       mc: 1200000000,           // market cap
 *       supply: 14250,            // circulating supply
 *       // ... many more fields
 *     }
 *   }
 *   Rate limit: depends on plan (Lite: 10/s, Starter: 30/s, etc.)
 *
 * JUPITER ULTRA QUOTE
 *   Endpoint: GET https://lite-api.jup.ag/ultra/v1/quote
 *   Params:   ?inputMint=<USDC>&outputMint=<TOKEN>&amount=<LAMPORTS>
 *   Headers:  X-API-Key: <optional key>
 *   Response: {
 *     mode: "ultra",
 *     inAmount: "10000000000",    // input in smallest unit (USDC has 6 decimals)
 *     outAmount: "11876543",      // output in token's smallest unit
 *     priceImpactPct: "0.0523",   // ← % price moved against you (SIGNAL 3)
 *                                 //   string, can be negative (= favorable)
 *                                 //   might be missing for pure RFQ quotes
 *     swapMode: "ExactIn",
 *     slippageBps: 26,
 *     routePlan: [...],           // array of route steps
 *     feeBps: 2,
 *   }
 *   If no route exists: HTTP 400 with error message
 *   Rate limit: Lite tier = 60 req/min, Pro = 600/min, Ultra = 6000/min
 *
 * ══════════════════════════════════════════════════════════════════════
 */

// ─── CONSTANTS ───────────────────────────────────────────────────────

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

// We test price impact at 3 sizes to see how liquidity holds up.
// $1K  = small trade (should be near-zero impact for any real token)
// $10K = medium trade (our main scoring signal)
// $50K = stress test (shows how deep the liquidity really is)
const SWAP_AMOUNTS_USD = [1_000, 10_000, 50_000];

// ─── TYPES ───────────────────────────────────────────────────────────

interface BirdeyeData {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  volume24h: number; // v24hUSD from Birdeye
  liquidity: number; // total TVL across all pools
  error?: string;
}

interface JupiterQuote {
  mint: string;
  amountUsd: number;
  outAmount: string;
  priceImpactPct: number | null; // null = no route or RFQ with no impact data
  routeFound: boolean;
  swapType: string; // "aggregator" or "rfq"
  error?: string;
}

interface TokenScore {
  mint: string;
  symbol: string;
  name: string;
  // Raw data
  price: number;
  volume24h: number;
  liquidity: number;
  priceImpact1k: number | null;
  priceImpact10k: number | null;
  priceImpact50k: number | null;
  // Scoring
  volumeNorm: number;
  liquidityNorm: number;
  impactNorm: number;
  compositeScore: number;
  winner: boolean;
}

// ─── BIRDEYE: Token Overview ─────────────────────────────────────────

async function fetchBirdeyeOverview(mint: string): Promise<BirdeyeData> {
  const apiKey = process.env['BIRDEYE_API_KEY'];
  if (!apiKey) {
    return {
      mint,
      symbol: "?",
      name: "?",
      price: 0,
      volume24h: 0,
      liquidity: 0,
      error: "BIRDEYE_API_KEY env var not set",
    };
  }

  // Birdeye Token Overview — returns comprehensive token stats
  // Docs: https://docs.birdeye.so/reference/get-defi-token_overview
  const url = `https://public-api.birdeye.so/defi/token_overview?address=${mint}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-API-KEY": apiKey,
        "x-chain": "solana",
        accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        mint,
        symbol: "?",
        name: "?",
        price: 0,
        volume24h: 0,
        liquidity: 0,
        error: `Birdeye HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const json = (await res.json()) as Record<string, any>;
    const d = json['data'];

    if (!d) {
      return {
        mint,
        symbol: "?",
        name: "?",
        price: 0,
        volume24h: 0,
        liquidity: 0,
        error: "Birdeye returned no data for this mint",
      };
    }

    return {
      mint,
      symbol: d.symbol ?? "?",
      name: d.name ?? "?",
      price: d.price ?? 0,
      volume24h: d.v24hUSD ?? 0, // ← key field: 24h volume in USD
      liquidity: d.liquidity ?? 0, // ← key field: total TVL across pools
    };
  } catch (err: any) {
    return {
      mint,
      symbol: "?",
      name: "?",
      price: 0,
      volume24h: 0,
      liquidity: 0,
      error: `Birdeye fetch error: ${err.message}`,
    };
  }
}

// ─── JUPITER: Ultra Quote ────────────────────────────────────────────

async function fetchJupiterQuote(
  outputMint: string,
  amountUsd: number
): Promise<JupiterQuote> {
  // Convert USD amount to USDC lamports (USDC has 6 decimals)
  // e.g. $10,000 → 10_000_000_000 lamports
  const lamports = amountUsd * 10 ** USDC_DECIMALS;

  // Jupiter Ultra Quote — simulates a swap and returns expected output + price impact
  // Docs: https://dev.jup.ag/docs/ultra/response
  const url = new URL("https://lite-api.jup.ag/ultra/v1/quote");
  url.searchParams.set("inputMint", USDC_MINT);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", lamports.toString());

  const headers: Record<string, string> = {};
  if (process.env['JUPITER_API_KEY']) {
    headers["X-API-Key"] = process.env['JUPITER_API_KEY'];
  }

  try {
    const res = await fetch(url.toString(), { headers });

    if (!res.ok) {
      const body = await res.text();
      return {
        mint: outputMint,
        amountUsd,
        outAmount: "0",
        priceImpactPct: null,
        routeFound: false,
        swapType: "none",
        error: `Jupiter HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as Record<string, any>;

    // priceImpactPct is a STRING in Jupiter's response, e.g. "0.0523" or "-0.0001"
    // - Positive = price moved against you (bad, you got less than fair price)
    // - Negative = price moved in your favor (good, common with RFQ quotes)
    // - Missing  = RFQ quote with no on-chain routing (treat as 0 impact)
    let impact: number | null = null;
    if (data['priceImpactPct'] !== undefined && data['priceImpactPct'] !== null) {
      impact = parseFloat(data['priceImpactPct']);
    } else if (data['swapType'] === "rfq") {
      // Pure RFQ quotes don't route through AMMs, so no on-chain price impact
      impact = 0;
    }

    return {
      mint: outputMint,
      amountUsd,
      outAmount: data['outAmount'] ?? data['outputAmount'] ?? "0",
      priceImpactPct: impact,
      routeFound: true,
      swapType: data['swapType'] ?? "unknown",
    };
  } catch (err: any) {
    return {
      mint: outputMint,
      amountUsd,
      outAmount: "0",
      priceImpactPct: null,
      routeFound: false,
      swapType: "none",
      error: `Jupiter fetch error: ${err.message}`,
    };
  }
}

// ─── SCORING ─────────────────────────────────────────────────────────

function computeScores(
  birdeyeData: BirdeyeData[],
  jupiterQuotes: Map<string, JupiterQuote[]>
): TokenScore[] {
  // Build raw score objects
  const scores: TokenScore[] = birdeyeData.map((be) => {
    const quotes = jupiterQuotes.get(be.mint) || [];
    return {
      mint: be.mint,
      symbol: be.symbol,
      name: be.name,
      price: be.price,
      volume24h: be.volume24h,
      liquidity: be.liquidity,
      priceImpact1k:
        quotes.find((q) => q.amountUsd === 1_000)?.priceImpactPct ?? null,
      priceImpact10k:
        quotes.find((q) => q.amountUsd === 10_000)?.priceImpactPct ?? null,
      priceImpact50k:
        quotes.find((q) => q.amountUsd === 50_000)?.priceImpactPct ?? null,
      volumeNorm: 0,
      liquidityNorm: 0,
      impactNorm: 0,
      compositeScore: 0,
      winner: false,
    };
  });

  // ── Normalize each signal to [0, 1] across all candidates ──

  // Volume: higher = better → score = value / max
  const maxVol = Math.max(...scores.map((s) => s.volume24h), 1);

  // Liquidity: higher = better → score = value / max
  const maxLiq = Math.max(...scores.map((s) => s.liquidity), 1);

  // Price impact at $10K: LOWER absolute value = better
  // We use absolute value because negative impact is actually good (favorable)
  // No route = worst possible score (0)
  for (const s of scores) {
    // Volume normalized
    s.volumeNorm = s.volume24h / maxVol;

    // Liquidity normalized
    s.liquidityNorm = s.liquidity / maxLiq;

    // Impact normalized: we want lower abs(impact) to score higher
    if (s.priceImpact10k !== null) {
      // abs() because negative impact is good, we just want to see magnitude
      const absImpact = Math.abs(s.priceImpact10k);
      // Score: e^(-impact) gives ~1 for 0% impact, ~0.9 for 0.1%, ~0.37 for 1%, ~0 for >5%
      s.impactNorm = Math.exp(-absImpact * 10);
    } else {
      // No route found = score 0
      s.impactNorm = 0;
    }

    // Composite: weighted average of 3 signals
    s.compositeScore =
      s.volumeNorm * 0.4 + s.liquidityNorm * 0.3 + s.impactNorm * 0.3;
  }

  // Sort by composite (highest first) and mark winner
  scores.sort((a, b) => b.compositeScore - a.compositeScore);
  if (scores.length > 0) scores[0]!.winner = true;

  return scores;
}

// ─── DISPLAY ─────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number | null): string {
  if (n === null) return "NO ROUTE";
  if (n < 0) return `${n.toFixed(6)}% (favorable)`;
  return `${n.toFixed(6)}%`;
}

function fmtScore(n: number): string {
  return (n * 100).toFixed(1) + "/100";
}

function printResults(scores: TokenScore[]) {
  console.log("\n" + "═".repeat(80));
  console.log("  LIQUIDITY COMPARISON RESULTS");
  console.log("  Scoring: 40% volume + 30% liquidity + 30% inverse price impact");
  console.log("═".repeat(80));

  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]!;
    const rank = i + 1;
    const tag = s.winner ? " ◀ WINNER — keep this one" : " — remove from curated";

    console.log(`\n  #${rank} ${s.symbol} (${s.name})${tag}`);
    console.log(`  Mint: ${s.mint}`);
    console.log(`  Price: $${s.price.toLocaleString()}`);
    console.log(`  │`);
    console.log(
      `  ├─ 24h Volume:        ${fmtUsd(s.volume24h).padEnd(12)} (score: ${fmtScore(s.volumeNorm)})`
    );
    console.log(
      `  ├─ Liquidity (TVL):   ${fmtUsd(s.liquidity).padEnd(12)} (score: ${fmtScore(s.liquidityNorm)})`
    );
    console.log(`  ├─ Price Impact $1K:  ${fmtPct(s.priceImpact1k)}`);
    console.log(
      `  ├─ Price Impact $10K: ${fmtPct(s.priceImpact10k).padEnd(24)} (score: ${fmtScore(s.impactNorm)})`
    );
    console.log(`  ├─ Price Impact $50K: ${fmtPct(s.priceImpact50k)}`);
    console.log(`  │`);
    console.log(`  └─ COMPOSITE SCORE:   ${fmtScore(s.compositeScore)}`);
  }

  console.log("\n" + "─".repeat(80));

  const winner = scores.find((s) => s.winner);
  const losers = scores.filter((s) => !s.winner);

  if (winner) {
    console.log(`\n  ✅ WINNER: ${winner.symbol} (${winner.mint})`);
    console.log(`     Keep in curated-assets.ts\n`);
    console.log(`  ❌ REMOVE from curated-assets.ts:`);
    for (const l of losers) {
      console.log(`     - ${l.symbol} (${l.mint})`);
    }
    console.log();

    // Machine-readable output for scripting
    console.log(`WINNER_MINT=${winner.mint}`);
    console.log(`WINNER_SYMBOL=${winner.symbol}`);
    for (let i = 0; i < losers.length; i++) {
      const loser = losers[i]!;
      console.log(`LOSER_${i}_MINT=${loser.mint}`);
      console.log(`LOSER_${i}_SYMBOL=${loser.symbol}`);
    }
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────

async function main() {
  const mints = process.argv.slice(2);

  if (mints.length < 2) {
    console.error(
      "\nUsage: npx tsx scripts/compare-liquidity.ts <mint1> <mint2> [mint3] [mint4]"
    );
    console.error(
      "\nCompares on-chain liquidity between tokens and picks the most liquid one."
    );
    console.error("Requires BIRDEYE_API_KEY env var. JUPITER_API_KEY is optional.\n");
    console.error("Example (dedup wrapped BTC):");
    console.error(
      "  npx tsx scripts/compare-liquidity.ts 21BTCo9h... cbbtcf3a... 5XZw2LKT... zBTCug3e...\n"
    );
    process.exit(1);
  }

  // Validate env
  if (!process.env['BIRDEYE_API_KEY']) {
    console.error("ERROR: BIRDEYE_API_KEY env var not set");
    process.exit(1);
  }

  console.log(`\nComparing ${mints.length} tokens...`);
  console.log(
    `APIs: Birdeye (token_overview) + Jupiter (ultra/v1/quote at $1K/$10K/$50K)\n`
  );

  // ── Step 1: Birdeye data (parallel) ──
  console.log("Step 1/2: Fetching Birdeye token_overview for each mint...");
  const birdeyeResults: BirdeyeData[] = [];

  for (const mint of mints) {
    const result = await fetchBirdeyeOverview(mint);
    birdeyeResults.push(result);

    if (result.error) {
      console.log(`  ⚠ ${mint.slice(0, 12)}...: ${result.error}`);
    } else {
      console.log(
        `  ✓ ${result.symbol.padEnd(8)} vol=${fmtUsd(result.volume24h).padEnd(10)} liq=${fmtUsd(result.liquidity).padEnd(10)} price=$${result.price}`
      );
    }

    // Birdeye rate limit: be polite
    await sleep(300);
  }

  // ── Step 2: Jupiter quotes at 3 sizes (sequential to avoid rate limits) ──
  console.log(
    "\nStep 2/2: Fetching Jupiter ultra quotes ($1K, $10K, $50K swaps)..."
  );
  const jupiterQuotes = new Map<string, JupiterQuote[]>();

  for (const mint of mints) {
    const symbol =
      birdeyeResults.find((r) => r.mint === mint)?.symbol ?? mint.slice(0, 8);
    const quotes: JupiterQuote[] = [];

    for (const amount of SWAP_AMOUNTS_USD) {
      const q = await fetchJupiterQuote(mint, amount);
      quotes.push(q);

      if (q.error) {
        console.log(`  ⚠ ${symbol} @ ${fmtUsd(amount)}: ${q.error}`);
      } else if (!q.routeFound) {
        console.log(`  ✗ ${symbol} @ ${fmtUsd(amount)}: no route available`);
      } else {
        console.log(
          `  ✓ ${symbol} @ ${fmtUsd(amount)}: impact=${fmtPct(q.priceImpactPct)} [${q.swapType}]`
        );
      }

      // Jupiter rate limit: be polite (especially on free tier)
      await sleep(500);
    }

    jupiterQuotes.set(mint, quotes);
  }

  // ── Step 3: Score and display ──
  const scores = computeScores(birdeyeResults, jupiterQuotes);
  printResults(scores);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
