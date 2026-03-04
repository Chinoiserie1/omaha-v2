# Thesis Algorithm — Design Document

> Source of truth for algorithm design intent. Explains **why** each decision was made.
> For **how** individual pieces work, see: `DATA-PIPELINE.md`, `ASSET-PIPELINE.md`, `backtest.md`.

---

## 1. Problem Statement

We track crypto KOLs (Key Opinion Leaders) on Twitter and want to answer one question:

**"If I copied this KOL's investment thesis exactly, what portfolio would I hold today, and how would it have performed?"**

This requires:
1. Ingesting tweets in real-time
2. Separating signal from noise (classification)
3. Maintaining a rolling investment thesis (portfolio synthesis)
4. Backtesting that thesis against real prices

The output is a portfolio allocation (e.g., 40% SOL, 20% ETH, 40% USDC) that evolves over time as the KOL tweets.

---

## 2. Architecture Decision: LLM over ML

### Why not traditional ML/NLP?

| Approach | Accuracy (est.) | Training data needed | Cost | Flexibility |
|----------|-----------------|---------------------|------|-------------|
| VADER sentiment | ~65% | None | Free | Very low — bag of words, no context |
| FinBERT/BERT fine-tuned | ~80-85% | 10k+ labeled tweets | GPU time | Medium — needs retraining per domain |
| Claude Haiku (our choice) | ~92-95% | None (zero-shot) | ~$3/month | High — prompt changes, no retraining |

### Key reasons

1. **No labeled training data.** We have no corpus of crypto tweets labeled with categories, sentiment, and conviction. Building one would take weeks.
2. **Domain is adversarial.** Crypto Twitter uses slang, irony, cashtags, memes. Traditional NLP breaks on "ngmi if you're not loading SOL here." An LLM understands this natively.
3. **Multi-task in one call.** We need category + assets + sentiment + conviction simultaneously. Traditional ML would need separate models or a complex multi-head architecture.
4. **Cost is negligible.** At ~30 tweets/batch, ~10 KOLs, running every 30 min, Claude Haiku costs roughly $3/month.
5. **Iterability.** When classification is wrong, we fix the prompt — no retraining pipeline, no GPU, no data labeling.

### Research backing

- **Trading-R1** (2025): LLM reasoning for trading signals outperforms traditional sentiment models
- **FINCON** (2024): Multi-agent LLM systems for financial concept extraction
- **SAPPO** (2024): Self-aligned preference optimization for financial NLP

---

## 3. Two-Call Pipeline

The algorithm uses two sequential LLM calls per KOL per run:

```
Tweets ──→ [Call 1: Classify+Extract] ──→ Classifications ──→ [Call 2: Synthesize] ──→ Portfolio
```

### Call 1: Classification (`classifier.service.ts`)

- **Input**: Batch of up to 30 tweets (threads merged into single units)
- **Output**: For each tweet: `{ category, assets[], sentiment, conviction }`
- **Model**: Claude Haiku
- **Prompt**: `CLASSIFICATION_SYSTEM_PROMPT` in `classification.schema.ts`

Why batch? Reduces API calls and cost. 30 is the sweet spot — larger batches increase context length and error rate.

### Call 2: Thesis Synthesis (`thesis.service.ts`)

- **Input**: Current portfolio state + new classified tweets (non-noise only)
- **Output**: Full portfolio allocation JSON with reasoning
- **Model**: Claude Haiku
- **Prompt**: `buildThesisSystemPrompt()` in `classification.schema.ts`

Why two calls instead of one? Separation of concerns. Classification is stateless (each tweet independently). Synthesis is stateful (must consider the current portfolio). Combining them would make the prompt unwieldy and error-prone.

---

## 4. Rolling Thesis Model

### The core insight: positions persist until contradicted

This is **not** a sliding time window model. We don't say "look at tweets from the last 7 days." Instead:

> A position exists until the KOL explicitly changes it.

This is critical for KOLs like Arthur Hayes ("CryptoHayes") who might tweet once about buying SOL, then not mention it for months while still holding. A time-window model would drop that position after 7 or 30 days. Our model carries it forward.

### State machine analogy

```
                    KOL tweets "buying SOL"
    [No Position] ──────────────────────────→ [Active Position: SOL 40%]
                                                        │
                                    KOL tweets nothing   │  KOL tweets "trimming SOL"
                                    about SOL for 60d    │
                                            │            ▼
                                            │  [Reduced Position: SOL 20%]
                                            ▼
                              [Decayed: conviction drops]
                                            │
                                   >90 days │
                                            ▼
                              [Stale: marked for review]
```

### Carry-forward in practice

The synthesis prompt includes:
```
CURRENT THESIS STATE (carry forward unless contradicted):
{ "allocations": [{ "asset": "SOL", "percentage": 40, ... }] }

NEW RELEVANT TWEETS (since last update, chronological):
[2025-01-20] (market_analysis, bullish, medium) "ETH looking strong here"
```

The LLM sees the existing SOL position and the new ETH signal. It must carry SOL forward unchanged and add ETH.

---

## 5. Classification Schema

### Categories

| Category | Description | Example |
|----------|-------------|---------|
| `investment_call` | KOL explicitly states a position (buy/sell/hold) | "Loading SOL at $140" |
| `market_analysis` | Analysis without stating a personal position | "ETH/BTC ratio looking bullish on the weekly" |
| `thesis_update` | KOL changes an existing position | "Trimming SOL, rotating into ETH" |
| `noise` | Everything else — memes, personal, politics | "gm frens, coffee first" |

Why these four? They map to portfolio actions:
- `investment_call` → add/confirm position
- `thesis_update` → modify/remove position
- `market_analysis` → may influence conviction level but not allocation
- `noise` → filtered out before synthesis

### Sentiment

`bullish | bearish | neutral` — applied to the mentioned assets, not the tweet overall.

### Conviction

`low | medium | high` — based on language strength:
- **high**: "Loading the boat", "max conviction", "this is the one"
- **medium**: "Looking good", "adding some", "interesting setup"
- **low**: "Watching this", "might be worth a look", "on my radar"

**Critical constraint**: The LLM MUST return exactly one of `"low"`, `"medium"`, `"high"`. No other values (like `"neutral"`) are valid. This is enforced in the Zod schema (`z.enum(["low", "medium", "high"])`) and explicitly stated in the synthesis prompt.

The `"stale"` conviction value is **never returned by the LLM** — it is added post-synthesis by the conviction decay function.

### Asset detection

The classifier normalizes asset mentions using `asset-aliases.json` (~550 entries):
- Cashtags: `$SOL` → `SOL`
- Full names: `"Solana"` → `SOL`
- Slang: `"jito"` → `JTO`
- Trading pairs: `"ZEC/BTC"` → `["ZEC", "BTC"]`

---

## 6. Thesis Synthesis Rules

### Carry-forward behavior

The synthesis prompt enforces:
1. **Positions persist** unless explicitly contradicted by a new tweet
2. **No silent removals** — only reduce/remove if the KOL says so
3. **No silent additions** — only add if the KOL explicitly mentions buying/bullish

### Conviction values

The LLM returns `"low" | "medium" | "high"` only. The `"stale"` value is applied post-LLM by `applyConvictionDecay()` — it is never in the prompt or expected from the LLM.

Portfolio schema (`portfolio.schema.ts`) accepts all four: `z.enum(["low", "medium", "high", "stale"])` — because stored snapshots may have decayed values.

### Allocation constraints

| Rule | Value | Enforced by |
|------|-------|-------------|
| Sum to 100% | ±5% tolerance | `synthesizeSingleSnapshot()` rejects if outside 95-105% |
| Minimum per asset | 5% | Prompt instruction |
| Unallocated → USDC | Remainder | Prompt instruction |
| Assets must be from curated list | ~155 symbols | Prompt receives `AVAILABLE TRADEABLE ASSETS` |

### Why USDC as remainder?

USDC represents "cash" — the KOL hasn't expressed a view on those funds. It's the default safe position that keeps allocations summing to 100%.

---

## 7. Conviction Decay

### Why it exists

KOLs go silent. A position with "high" conviction from 3 months ago shouldn't have the same weight as one from yesterday. Decay is a heuristic that degrades conviction over time to reflect staleness.

### Thresholds

| Days since last signal | Effect |
|----------------------|--------|
| 0–30 | No change |
| 31–90 | `high` → `medium`, `medium` → `low` |
| >90 | Any → `stale` |

### Implementation (`applyConvictionDecay()` in `thesis.service.ts`)

- Applied **after** LLM synthesis, before saving the snapshot
- Uses `lastSignal` date from the allocation (when the KOL last tweeted about that asset)
- USDC is exempt from decay
- **Reference date**: Uses the snapshot's timestamp, NOT `new Date()`. This is critical for retroactive snapshots — a snapshot generated for January 2025 must use January 2025 as "now", not the current date.

### Why not remove stale positions?

Stale positions are still carried forward. The KOL never said to close them. They just haven't reaffirmed recently. The UI can surface staleness to the user, and the backtest still includes them at their original allocation percentage.

---

## 8. Asset Pipeline

### The problem

Jupiter lists 4000+ tradeable tokens on Solana. Sending all of them to the LLM prompt would:
- Blow up the context window
- Confuse the model with thousands of irrelevant microcaps
- Cost significantly more per call

### Two-tier solution

**Tier 1: Asset Aliases** (`asset-aliases.json`, ~550 entries)
- Used by the **classifier** to normalize raw mentions
- Maps slang, full names, cashtags to canonical symbols
- Example: `"solana"` → `"SOL"`, `"jito"` → `"JTO"`, `"nvidia"` → `"NVDAx"`

**Tier 2: Curated Assets** (`curated-assets.ts`, ~155 entries)
- Used by the **synthesis prompt** as the investable universe
- Each entry has: symbol, name, Solana mint address, decimals, category
- Categories: `crypto`, `stock`, `index`, `commodity`, `fixed_income`
- Includes tokenized stocks (xStocks, Ondo) for KOLs who discuss equities

### Flow

```
Tweet: "loading some jito here"
  ↓ classifier (uses aliases)
Classification: { assets: ["JTO"], sentiment: "bullish" }
  ↓ synthesis (uses curated list)
Portfolio: { asset: "JTO", percentage: 15%, conviction: "high" }
  ↓ rebalancer (uses Jupiter tradeable map)
On-chain swap: USDC → JTO via Jupiter
```

### Adding a new asset

Both files must be updated together. See `ASSET-PIPELINE.md` for the full procedure. The curated list is a **derived** file — its contents come from alias targets cross-referenced with Jupiter tradeability and stock deduplication.

---

## 9. Retroactive Snapshots

### The problem: cold starts

When a KOL is added to the system, they may have weeks or months of historical tweets. We need to build a thesis history, not just a single "current" snapshot.

### Weekly window generation

Instead of synthesizing one giant "here are all 200 tweets, figure it out" snapshot, we generate weekly windows (Monday–Sunday):

```
Week 1 (Jan 6–12): Cold start from scratch with tweets in this window
Week 2 (Jan 13–19): Incremental update from Week 1's output + new tweets
Week 3 (Jan 20–26): Incremental update from Week 2's output + new tweets
...
```

### Why weekly?

- Daily would be too many LLM calls (expensive, slow)
- Monthly would miss important intra-month shifts
- Weekly balances granularity with cost

### Cumulative vs incremental prompts

- **First window**: "Build their thesis from scratch" — all tweets up to that point
- **Subsequent windows**: "Here's the current state, update based on new tweets" — carry-forward model

### Implementation (`generateRetroactiveSnapshots()` in `thesis.service.ts`)

- `generateWeeklyWindows()` computes Monday-to-Sunday windows between the earliest and latest tweet dates
- Tweets are sorted by `tweet.postedAt` (not `classifiedAt`, which is bulk classification time)
- Each snapshot's `createdAt` is set to the window's end date
- Conviction decay uses the window's end date as reference, not current time
- `synthesizeSingleSnapshot()` is the shared pipeline for both retroactive and incremental paths

### Gap detection

If new historical tweets are discovered before the earliest existing snapshot, the system automatically backfills retroactive snapshots for the gap period, then continues with the normal incremental path for new tweets.

---

## 10. Backtest Math

### Weighted return formula

For each period between two consecutive snapshots:

```
periodReturn = Σ (weight_i × assetReturn_i)

where:
  weight_i = allocation_percentage_i / 100
  assetReturn_i = (price_to - price_from) / price_from
```

Cumulative value compounds across periods:

```
cumulativeValue_n = cumulativeValue_{n-1} × (1 + periodReturn_n)
```

Starting value is 1.0 (representing $1 invested).

### Price resolution

- Prices are fetched from Birdeye/Jupiter for each asset at each snapshot date
- If exact date price is missing, the system uses the closest available price (fallback logic in `price.service.ts`)
- If both from/to prices resolve to the same date, a warning is logged (indicates missing price data)
- Missing prices result in 0% return for that asset in that period

### Same-day deduplication

Multiple snapshots on the same day are deduplicated — the last snapshot of the day wins. This prevents artificial 0% return periods where the "from" and "to" prices would be identical.

### Stored vs computed

- `computeLatestPeriod()` runs automatically after each new snapshot (cron-driven)
- `runBacktest()` reads stored `SnapshotPerformance` rows and backfills any missing periods
- Cumulative values are recomputed from scratch during full backtest to avoid stale stored values

---

## Appendix: Key Files

| File | Responsibility |
|------|---------------|
| `packages/shared/src/schemas/classification.schema.ts` | Classification + synthesis prompts, Zod schemas |
| `packages/shared/src/schemas/portfolio.schema.ts` | Portfolio output schema (with `stale` conviction) |
| `apps/back/src/services/classifier.service.ts` | Tweet classification pipeline (Call 1) |
| `apps/back/src/services/thesis.service.ts` | Thesis synthesis + decay + retroactive snapshots (Call 2) |
| `apps/back/src/services/backtest.service.ts` | Period return computation + full backtest |
| `apps/back/src/data/curated-assets.ts` | Investable universe (~155 assets) |
| `apps/back/src/data/asset-aliases.json` | Fuzzy matching aliases (~550 entries) |
