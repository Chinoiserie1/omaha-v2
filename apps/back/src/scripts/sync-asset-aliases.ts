import { prisma } from "@repo/database";
import axios from "axios";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALIASES_PATH = resolve(__dirname, "../data/asset-aliases.json");

const BIRDEYE_API_KEY = process.env["BIRDEYE_API_KEY"];
if (!BIRDEYE_API_KEY) {
  console.error("BIRDEYE_API_KEY is required");
  process.exit(1);
}

const BIRDEYE_URL = "https://public-api.birdeye.so/defi/token_trending";
const PAGE_SIZE = 20;
const TOTAL_TOKENS = 300;

interface BirdeyeToken {
  address: string;
  symbol: string;
  name: string;
}

interface BirdeyeResponse {
  data: {
    tokens: BirdeyeToken[];
  };
  success: boolean;
}

// --- Manual maps ---

const STOCK_TICKERS: Record<string, string> = {
  AAPL: "Apple",
  TSLA: "Tesla",
  NVDA: "NVIDIA",
  AMZN: "Amazon",
  GOOGL: "Google",
  META: "Meta",
  MSFT: "Microsoft",
  NFLX: "Netflix",
  AMD: "AMD",
  INTC: "Intel",
  COIN: "Coinbase",
  HOOD: "Robinhood",
  MSTR: "MicroStrategy",
  CRM: "Salesforce",
  PLTR: "Palantir",
  UBER: "Uber",
  SQ: "Block",
  PYPL: "PayPal",
  SHOP: "Shopify",
  SNOW: "Snowflake",
  NET: "Cloudflare",
  RBLX: "Roblox",
  SPOT: "Spotify",
  DIS: "Disney",
  BA: "Boeing",
  JPM: "JPMorgan",
  GS: "Goldman Sachs",
  V: "Visa",
  MA: "Mastercard",
  WMT: "Walmart",
  COST: "Costco",
  NKE: "Nike",
  KO: "Coca-Cola",
  PEP: "PepsiCo",
  MCD: "McDonald's",
  PFE: "Pfizer",
  JNJ: "Johnson & Johnson",
  UNH: "UnitedHealth",
  LLY: "Eli Lilly",
  MRNA: "Moderna",
  SPY: "S&P 500 ETF",
  QQQ: "Nasdaq 100 ETF",
  IWM: "Russell 2000 ETF",
  DIA: "Dow Jones ETF",
  TLT: "Treasury Bond ETF",
  GLD: "Gold ETF",
  SLV: "Silver ETF",
  VTI: "Total Stock Market ETF",
  VOO: "S&P 500 Vanguard ETF",
  ARKK: "ARK Innovation ETF",
};

const EXTRA_TOKENS: Record<string, string> = {
  ranger: "RNGR",
  rngr: "RNGR",
  ondo: "ONDO",
};

function buildStockAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const [ticker, name] of Object.entries(STOCK_TICKERS)) {
    const lower = ticker.toLowerCase();
    aliases[lower] = ticker;
    aliases[`${lower}on`] = ticker; // ONDO suffix
    aliases[`${lower}x`] = ticker; // xStocks suffix
    aliases[name.toLowerCase()] = ticker; // company name
  }
  return aliases;
}

async function fetchWithRetry(
  offset: number,
  retries = 3,
): Promise<BirdeyeToken[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get<BirdeyeResponse>(BIRDEYE_URL, {
        headers: {
          "X-API-KEY": BIRDEYE_API_KEY,
          "x-chain": "solana",
        },
        params: {
          sort_by: "volume24hUSD",
          sort_type: "desc",
          limit: PAGE_SIZE,
          offset,
        },
      });
      if (response.data.success && response.data.data?.tokens) {
        return response.data.data.tokens;
      }
      return [];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const wait = 2000 * (attempt + 1);
        console.log(`    Rate limited, waiting ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw error;
    }
  }
  console.warn(`    Failed after ${retries} retries for offset ${offset}`);
  return [];
}

async function fetchBirdeyeTokens(): Promise<BirdeyeToken[]> {
  const allTokens: BirdeyeToken[] = [];
  const pages = Math.ceil(TOTAL_TOKENS / PAGE_SIZE);

  for (let i = 0; i < pages; i++) {
    const offset = i * PAGE_SIZE;
    console.log(`  Birdeye page ${i + 1}/${pages} (offset ${offset})...`);

    const tokens = await fetchWithRetry(offset);
    allTokens.push(...tokens);

    // Rate limit: 1.5s between requests
    if (i < pages - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return allTokens;
}

async function loadVerifiedMints(): Promise<Set<string>> {
  const assets = await prisma.tradeableAsset.findMany({
    where: { isActive: true },
    select: { mint: true },
  });
  return new Set(assets.map((a) => a.mint));
}

async function sync(): Promise<void> {
  // Step 1: Load existing aliases to preserve manual entries
  let existing: Record<string, string> = {};
  try {
    existing = JSON.parse(readFileSync(ALIASES_PATH, "utf-8"));
    console.log(`Loaded ${Object.keys(existing).length} existing aliases`);
  } catch {
    console.log("No existing aliases file found, starting fresh");
  }

  // Step 2: Fetch Birdeye top tokens
  console.log("Fetching top tokens from Birdeye...");
  const birdeyeTokens = await fetchBirdeyeTokens();
  console.log(`Fetched ${birdeyeTokens.length} tokens from Birdeye`);

  // Step 3: Load Jupiter verified mints from DB
  console.log("Loading verified mints from TradeableAsset...");
  const verifiedMints = await loadVerifiedMints();
  console.log(`Loaded ${verifiedMints.size} verified mints`);

  // Step 4: Filter Birdeye tokens — only keep those with verified mints
  const verified = birdeyeTokens.filter((t) => verifiedMints.has(t.address));
  console.log(
    `${verified.length}/${birdeyeTokens.length} Birdeye tokens are Jupiter-verified`,
  );

  // Step 5: Build aliases from verified Birdeye tokens
  const birdeyeAliases: Record<string, string> = {};
  for (const token of verified) {
    const symbol = token.symbol.trim().toUpperCase();
    const lowerSymbol = token.symbol.trim().toLowerCase();
    const lowerName = token.name.trim().toLowerCase();

    // symbol alias: "wif" → "WIF"
    if (lowerSymbol && !birdeyeAliases[lowerSymbol]) {
      birdeyeAliases[lowerSymbol] = symbol;
    }
    // name alias: "dogwifhat" → "WIF"
    if (lowerName && lowerName !== lowerSymbol && !birdeyeAliases[lowerName]) {
      birdeyeAliases[lowerName] = symbol;
    }
  }

  // Step 6: Build stock aliases
  const stockAliases = buildStockAliases();

  // Step 7: Merge — priority: existing manual > stocks > extra tokens > birdeye
  const merged: Record<string, string> = {
    ...birdeyeAliases,
    ...EXTRA_TOKENS,
    ...stockAliases,
    ...existing,
  };

  // Step 8: Sort alphabetically and write
  const sorted = Object.keys(merged)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = merged[key]!;
        return acc;
      },
      {} as Record<string, string>,
    );

  writeFileSync(ALIASES_PATH, JSON.stringify(sorted, null, 2) + "\n");

  // Stats
  const birdeyeCount = Object.keys(birdeyeAliases).length;
  const stockCount = Object.keys(stockAliases).length;
  const extraCount = Object.keys(EXTRA_TOKENS).length;
  const totalCount = Object.keys(sorted).length;

  console.log("\n--- Stats ---");
  console.log(`Birdeye verified aliases: ${birdeyeCount}`);
  console.log(`Stock aliases: ${stockCount}`);
  console.log(`Extra token aliases: ${extraCount}`);
  console.log(`Existing preserved: ${Object.keys(existing).length}`);
  console.log(`Total aliases written: ${totalCount}`);
  console.log(`Output: ${ALIASES_PATH}`);
}

sync()
  .catch((error) => {
    console.error("Sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
