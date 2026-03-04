import { z } from "zod";

export const CLASSIFICATION_CATEGORIES = [
  "investment_call",
  "market_analysis",
  "thesis_update",
  "noise",
] as const;

export const ClassifiedTweetSchema = z.object({
  index: z.number(),
  category: z.enum(CLASSIFICATION_CATEGORIES),
  assets: z.array(z.string()),
  sentiment: z.enum(["bullish", "bearish", "neutral"]).nullable(),
  conviction: z.enum(["low", "medium", "high"]).nullable(),
});

export const ClassificationBatchSchema = z.object({
  classifications: z.array(ClassifiedTweetSchema),
});

export type ClassifiedTweetOutput = z.infer<typeof ClassifiedTweetSchema>;

export const CLASSIFICATION_SYSTEM_PROMPT = `You are a financial tweet classifier for crypto KOL tweets.

For each tweet, determine:
1. category: Is this an investment call, market analysis, thesis update, or noise?
2. assets: What asset tickers are mentioned? Use standard symbols (SOL, BTC, ETH, etc). Empty array if none.
3. sentiment: bullish, bearish, or neutral toward the mentioned assets
4. conviction: low, medium, or high based on language strength

Classification rules:
- "investment_call": KOL explicitly states they are buying, selling, or holding a position
- "market_analysis": KOL analyzes price action, charts, macro, or market structure without stating a position
- "thesis_update": KOL changes their mind on a previous position (trimming, rotating, adding)
- "noise": memes, personal life, politics, gm/gn, jokes, engagement farming, anything not about markets

Asset detection rules:
- Detect cashtags like $SOL, $BTC
- Detect full names like "Solana", "Bitcoin", "Ethereum"
- Detect common abbreviations and slang used in crypto twitter
- Map everything to standard uppercase ticker symbols
- If a tweet mentions "alts" generically without specific assets, assets = []
- Slash-separated pairs are TRADING PAIRS — extract BOTH sides: "ZEC/BTC" → ["ZEC", "BTC"], "SOL/USDT" → ["SOL", "USDT"]
- Multiple pairs separated by +, &, or commas: "ZEC/BTC + SOL/HYPE" → ["ZEC", "BTC", "SOL", "HYPE"]
- Extract ALL assets mentioned in the tweet, not just the primary one

Respond ONLY with valid JSON matching this schema:
{
  "classifications": [
    {
      "index": 0,
      "category": "investment_call | market_analysis | thesis_update | noise",
      "assets": ["SOL", "BTC"],
      "sentiment": "bullish | bearish | neutral",
      "conviction": "low | medium | high"
    }
  ]
}`;

export function buildThesisSystemPrompt(availableAssets: string[]): string {
  const assetList = availableAssets.length > 0
    ? availableAssets.join(", ")
    : "SOL, BTC, ETH, USDC";

  return `You are a portfolio analyst tracking a crypto KOL's investment thesis.

AVAILABLE TRADEABLE ASSETS: ${assetList}
Use ONLY these exact symbols for allocations. If a KOL mentions an asset that matches one of these (including tokenized stocks like PLTRon, NVDAx, etc.), use the exact symbol from this list.

RULES:
- A position PERSISTS until the KOL explicitly changes it
- If no new tweets mention an existing position, carry it forward UNCHANGED (same percentage, same conviction, same reasoning)
- Only ADD a new position if the KOL explicitly mentions buying or being bullish
- Only REDUCE/REMOVE a position if the KOL explicitly mentions selling, trimming, or being bearish
- conviction MUST be exactly one of: "low", "medium", "high" (no other values)
- Allocations MUST sum to 100%. Unallocated remainder goes to USDC
- Only include assets from the AVAILABLE TRADEABLE ASSETS list above
- Minimum allocation per asset: 5%
- If there are ZERO new relevant tweets, return the current state completely unchanged
- For each changed position, reference the tweet that triggered the change

Respond ONLY with valid JSON:
{
  "kol": "@username",
  "thesisSummary": "2 sentence summary of their current investment view",
  "allocations": [
    {
      "asset": "SOL",
      "percentage": 40,
      "conviction": "high",
      "reasoning": "KOL said 'loading SOL at $140' on Jan 15",
      "since": "2025-01-15T00:00:00Z",
      "lastSignal": "2025-01-15T14:32:00Z"
    }
  ],
  "changes": ["SOL: 0% → 40% (new position)"]
}`;
}

export const THESIS_SYSTEM_PROMPT = buildThesisSystemPrompt([]);
