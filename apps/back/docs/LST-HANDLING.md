# LST Handling

> How the thesis LLM handles Liquid Staking Tokens to prevent double-counting SOL exposure.

## What are LSTs?

Liquid Staking Tokens (LSTs) represent staked SOL plus accumulated yield. They are economically equivalent to SOL exposure:

| Symbol | Protocol | Description |
|--------|----------|-------------|
| JitoSOL | Jito | Jito Staked SOL (includes MEV yield) |
| mSOL | Marinade | Marinade staked SOL |
| bSOL | BlazeStake | BlazeStake Staked SOL |
| JupSOL | Jupiter | Jupiter Staked SOL |
| hSOL | Helius | Helius Staked SOL |
| INF | Sanctum | Infinity (Sanctum LST) |
| LST | Liquid Staking | Generic Liquid Staking Token |

All are in `curated-assets.ts` and tradeable on Jupiter.

## The Problem

Without guidance, the LLM allocates to both SOL and JitoSOL (or other LSTs) — creating 2x SOL exposure. Example:

```
SOL: 30%
JitoSOL: 15%
→ Actual SOL exposure: 45% (double-counted)
```

## The Solution

`apps/back/src/data/knowledge/asset-groups.ts` defines a **SOL Exposure** equivalence group that instructs the LLM:

- These are ALL forms of SOL. Pick ONE per position.
- If the KOL names a specific LST, use that LST.
- If the KOL just says "SOL", use SOL.
- Never allocate to both SOL and an LST.

This is injected into the thesis prompt via `buildGlobalKnowledgeContext()`.

## Code-Level Enforcement

The prompt-only approach is not 100% reliable — the LLM sometimes still returns multiple allocations from the same group. `mergeAssetGroupAllocations()` in `asset-groups.ts` enforces the rule in code.

### `synthesizeSingleSnapshot` pipeline steps

1. Build prompt (curated assets + knowledge context)
2. LLM call
3. JSON extraction
4. Schema validation (`PortfolioOutputSchema`)
5. Sum check (95-105%)
6. Alias normalization (`normalizeAsset`)
7. **Asset group merge** (`mergeAssetGroupAllocations`) — NEW
8. Mint resolution (tradeable assets map)
9. Conviction decay
10. Save snapshot

### How `mergeAssetGroupAllocations()` works

For each asset group with >1 allocation in the LLM output:

- **Winner asset**: prefer non-default member (e.g. JitoSOL over SOL). If multiple non-default, pick highest percentage.
- **percentage**: sum of all members in the group
- **conviction**: highest across members (`high > medium > low > stale`)
- **since**: earliest date
- **lastSignal**: latest date
- **reasoning**: winner's reasoning + `(merged with SOL 35%)`

### Example

```
LLM returns: SOL 35%, JitoSOL 15%
After merge:  JitoSOL 50% (reasoning includes "merged with SOL 35%")
```

## Adding a New LST

1. Add to `curated-assets.ts` (symbol, mint, decimals, category: "crypto")
2. Add to `asset-aliases.json` (lowercase alias → symbol)
3. Add the symbol to the `sol_exposure` group members in `asset-groups.ts`

## Related Files

- `apps/back/src/data/knowledge/asset-groups.ts` — equivalence group definitions
- `apps/back/src/data/knowledge/index.ts` — assembles knowledge for prompt
- `apps/back/src/data/curated-assets.ts` — all investable assets including LSTs
- `packages/shared/src/schemas/classification.schema.ts` — thesis prompt builder
