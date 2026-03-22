import { prisma } from "@repo/database";
import axios from "axios";

const JUPITER_API_KEY = process.env["JUPITER_API_KEY"];
if (!JUPITER_API_KEY) {
  console.error("JUPITER_API_KEY is required");
  process.exit(1);
}

const JUPITER_TOKENS_URL =
  "https://api.jup.ag/tokens/v2/tag?query=verified";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface JupiterToken {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

async function sync(): Promise<void> {
  console.log("Fetching verified tokens from Jupiter...");

  const response = await axios.get<JupiterToken[]>(JUPITER_TOKENS_URL, {
    headers: { "x-api-key": JUPITER_API_KEY },
  });

  const tokens = response.data;
  console.log(`Fetched ${tokens.length} tokens`);

  let upserted = 0;
  for (const token of tokens) {
    await prisma.token.upsert({
      where: { symbol: token.symbol },
      update: {
        name: token.name,
        mint: token.id,
        decimals: token.decimals,
        isActive: true,
        ...(token.icon ? { logoUri: token.icon } : {}),
      },
      create: {
        symbol: token.symbol,
        name: token.name,
        mint: token.id,
        decimals: token.decimals,
        ...(token.icon ? { logoUri: token.icon } : {}),
      },
    });
    upserted++;
  }

  // Ensure USDC always exists
  await prisma.token.upsert({
    where: { symbol: "USDC" },
    update: { mint: USDC_MINT, isActive: true },
    create: {
      symbol: "USDC",
      name: "USD Coin",
      mint: USDC_MINT,
      decimals: 6,
    },
  });

  console.log(`Upserted ${upserted} tokens`);
}

sync()
  .catch((error) => {
    console.error("Sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
