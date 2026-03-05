/**
 * Sync token icon URLs from Jupiter into the Token table.
 *
 * Usage:
 *   pnpm sync-icons
 *
 * Fetches all Jupiter-verified tokens in one bulk call, then upserts
 * logoUri for every curated asset found.
 */
import { prisma } from "@repo/database";
import axios from "axios";
import { CURATED_ASSETS } from "../data/curated-assets.js";

const JUPITER_API_KEY = process.env["JUPITER_API_KEY"];
if (!JUPITER_API_KEY) {
  console.error("JUPITER_API_KEY is required");
  process.exit(1);
}

const JUPITER_V2_URL = "https://api.jup.ag/tokens/v2/tag?query=verified";

interface JupiterToken {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

async function syncIcons(): Promise<void> {
  console.info("Fetching verified tokens from Jupiter V2...");
  const response = await axios.get<JupiterToken[]>(JUPITER_V2_URL, {
    headers: { "x-api-key": JUPITER_API_KEY },
  });

  const jupTokens = response.data;
  console.info(`Fetched ${jupTokens.length} verified tokens`);

  // Build mint → icon map
  const iconByMint = new Map<string, string>();
  for (const t of jupTokens) {
    if (t.icon) iconByMint.set(t.id, t.icon);
  }

  let found = 0;
  let missing = 0;
  const missingSymbols: string[] = [];

  for (const asset of CURATED_ASSETS) {
    const logoUri = iconByMint.get(asset.mint) ?? null;

    if (logoUri) {
      found++;
    } else {
      missing++;
      missingSymbols.push(asset.symbol);
    }

    await prisma.token.upsert({
      where: { mint: asset.mint },
      update: { ...(logoUri ? { logoUri } : {}) },
      create: {
        name: asset.name,
        symbol: asset.symbol,
        decimals: asset.decimals,
        mint: asset.mint,
        ...(logoUri ? { logoUri } : {}),
      },
    });
  }

  console.info(`\nCoverage: ${found}/${CURATED_ASSETS.length} icons found`);
  if (missingSymbols.length > 0) {
    console.warn(`Missing (${missing}): ${missingSymbols.join(", ")}`);
  }
}

syncIcons()
  .catch((error) => {
    console.error("Sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
