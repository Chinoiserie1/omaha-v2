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

// Stock tickers with company name and most liquid tokenized version
// Winner determined by Birdeye liquidity check on 2026-03-01
// "x" = xStock (Backed Finance, decimals 8), "on" = Ondo GM (decimals 9)
interface StockEntry {
  name: string;
  bestSuffix: "x" | "on";
  hasXstock: boolean;
  hasOndo: boolean;
}

const STOCK_TICKERS: Record<string, StockEntry> = {
  // --- Both xStock and Ondo exist (53 overlapping) ---
  // xStock wins (27):
  AAPL:  { name: "Apple",               bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  ABT:   { name: "Abbott",              bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  AMZN:  { name: "Amazon",              bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  COIN:  { name: "Coinbase",            bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  CRCL:  { name: "Circle",              bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  CSCO:  { name: "Cisco",               bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  CVX:   { name: "Chevron",             bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  GLD:   { name: "Gold ETF",            bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  GOOGL: { name: "Google",              bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  HOOD:  { name: "Robinhood",           bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  LIN:   { name: "Linde",               bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  LLY:   { name: "Eli Lilly",           bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  MCD:   { name: "McDonald's",          bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  META:  { name: "Meta",                bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  MRK:   { name: "Merck",               bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  MSTR:  { name: "MicroStrategy",       bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  NVDA:  { name: "NVIDIA",              bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  ORCL:  { name: "Oracle",              bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  PEP:   { name: "PepsiCo",             bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  PG:    { name: "Procter & Gamble",    bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  QQQ:   { name: "Nasdaq 100 ETF",      bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  SPY:   { name: "S&P 500 ETF",         bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  TSLA:  { name: "Tesla",               bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  UNH:   { name: "UnitedHealth",        bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  WMT:   { name: "Walmart",             bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  OPEN:  { name: "Opendoor",            bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  TMO:   { name: "Thermo Fisher",       bestSuffix: "x",  hasXstock: true,  hasOndo: true },
  // Ondo wins (26):
  ABBV:  { name: "AbbVie",              bestSuffix: "on", hasXstock: true,  hasOndo: true },
  ACN:   { name: "Accenture",           bestSuffix: "on", hasXstock: true,  hasOndo: true },
  APP:   { name: "AppLovin",            bestSuffix: "on", hasXstock: true,  hasOndo: true },
  AVGO:  { name: "Broadcom",            bestSuffix: "on", hasXstock: true,  hasOndo: true },
  BAC:   { name: "Bank of America",     bestSuffix: "on", hasXstock: true,  hasOndo: true },
  CRM:   { name: "Salesforce",          bestSuffix: "on", hasXstock: true,  hasOndo: true },
  CRWD:  { name: "CrowdStrike",         bestSuffix: "on", hasXstock: true,  hasOndo: true },
  GME:   { name: "GameStop",            bestSuffix: "on", hasXstock: true,  hasOndo: true },
  GS:    { name: "Goldman Sachs",       bestSuffix: "on", hasXstock: true,  hasOndo: true },
  HD:    { name: "Home Depot",          bestSuffix: "on", hasXstock: true,  hasOndo: true },
  IBM:   { name: "IBM",                 bestSuffix: "on", hasXstock: true,  hasOndo: true },
  INTC:  { name: "Intel",               bestSuffix: "on", hasXstock: true,  hasOndo: true },
  JNJ:   { name: "Johnson & Johnson",   bestSuffix: "on", hasXstock: true,  hasOndo: true },
  JPM:   { name: "JPMorgan",            bestSuffix: "on", hasXstock: true,  hasOndo: true },
  KO:    { name: "Coca-Cola",           bestSuffix: "on", hasXstock: true,  hasOndo: true },
  MA:    { name: "Mastercard",          bestSuffix: "on", hasXstock: true,  hasOndo: true },
  MRVL:  { name: "Marvell",             bestSuffix: "on", hasXstock: true,  hasOndo: true },
  MSFT:  { name: "Microsoft",           bestSuffix: "on", hasXstock: true,  hasOndo: true },
  NFLX:  { name: "Netflix",             bestSuffix: "on", hasXstock: true,  hasOndo: true },
  NVO:   { name: "Novo Nordisk",        bestSuffix: "on", hasXstock: true,  hasOndo: true },
  PFE:   { name: "Pfizer",              bestSuffix: "on", hasXstock: true,  hasOndo: true },
  PLTR:  { name: "Palantir",            bestSuffix: "on", hasXstock: true,  hasOndo: true },
  TQQQ:  { name: "ProShares UltraPro QQQ", bestSuffix: "on", hasXstock: true, hasOndo: true },
  V:     { name: "Visa",                bestSuffix: "on", hasXstock: true,  hasOndo: true },
  VTI:   { name: "Total Stock Market ETF", bestSuffix: "on", hasXstock: true, hasOndo: true },
  XOM:   { name: "Exxon Mobil",         bestSuffix: "on", hasXstock: true,  hasOndo: true },

  // --- xStocks only (10) ---
  AMBR:  { name: "Amber",               bestSuffix: "x",  hasXstock: true,  hasOndo: false },
  AZN:   { name: "AstraZeneca",          bestSuffix: "x",  hasXstock: true,  hasOndo: false },
  "BRK.B": { name: "Berkshire Hathaway", bestSuffix: "x",  hasXstock: true,  hasOndo: false },
  CMCSA: { name: "Comcast",              bestSuffix: "x",  hasXstock: true,  hasOndo: false },
  DFDV:  { name: "DFDV",                 bestSuffix: "x",  hasXstock: true,  hasOndo: false },
  DHR:   { name: "Danaher",              bestSuffix: "x",  hasXstock: true,  hasOndo: false },
  HON:   { name: "Honeywell",            bestSuffix: "x",  hasXstock: true,  hasOndo: false },
  MDT:   { name: "Medtronic",            bestSuffix: "x",  hasXstock: true,  hasOndo: false },
  PM:    { name: "Philip Morris",        bestSuffix: "x",  hasXstock: true,  hasOndo: false },
  TBLL:  { name: "US Treasury Bill ETF", bestSuffix: "x",  hasXstock: true,  hasOndo: false },

  // --- Ondo only (popular tickers not on xStocks) ---
  AMD:   { name: "AMD",                  bestSuffix: "on", hasXstock: false, hasOndo: true },
  UBER:  { name: "Uber",                 bestSuffix: "on", hasXstock: false, hasOndo: true },
  PYPL:  { name: "PayPal",               bestSuffix: "on", hasXstock: false, hasOndo: true },
  SHOP:  { name: "Shopify",              bestSuffix: "on", hasXstock: false, hasOndo: true },
  SNOW:  { name: "Snowflake",            bestSuffix: "on", hasXstock: false, hasOndo: true },
  SPOT:  { name: "Spotify",              bestSuffix: "on", hasXstock: false, hasOndo: true },
  DIS:   { name: "Disney",               bestSuffix: "on", hasXstock: false, hasOndo: true },
  BA:    { name: "Boeing",               bestSuffix: "on", hasXstock: false, hasOndo: true },
  NKE:   { name: "Nike",                 bestSuffix: "on", hasXstock: false, hasOndo: true },
  MRNA:  { name: "Moderna",              bestSuffix: "on", hasXstock: false, hasOndo: true },
  IWM:   { name: "Russell 2000 ETF",     bestSuffix: "on", hasXstock: false, hasOndo: true },
  TLT:   { name: "Treasury Bond ETF",    bestSuffix: "on", hasXstock: false, hasOndo: true },
  SLV:   { name: "Silver ETF",           bestSuffix: "on", hasXstock: false, hasOndo: true },
  COST:  { name: "Costco",               bestSuffix: "on", hasXstock: false, hasOndo: true },
};

const EXTRA_TOKENS: Record<string, string> = {
  ranger: "RNGR",
  rngr: "RNGR",
  ondo: "ONDO",
};

function buildStockAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const [ticker, entry] of Object.entries(STOCK_TICKERS)) {
    const lower = ticker.toLowerCase();
    const bestSymbol = `${ticker}${entry.bestSuffix}`;

    // Bare ticker + company name → most liquid version
    aliases[lower] = bestSymbol;
    aliases[entry.name.toLowerCase()] = bestSymbol;

    // Explicit suffixed aliases → their respective platform symbol
    if (entry.hasOndo) {
      aliases[`${lower}on`] = `${ticker}on`;
    }
    if (entry.hasXstock) {
      aliases[`${lower}x`] = `${ticker}x`;
    }
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

  // Step 7: Merge — priority: stocks > existing manual > extra tokens > birdeye
  // Stock aliases win over existing because they're computed from verified liquidity data
  const merged: Record<string, string> = {
    ...birdeyeAliases,
    ...EXTRA_TOKENS,
    ...existing,
    ...stockAliases,
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
