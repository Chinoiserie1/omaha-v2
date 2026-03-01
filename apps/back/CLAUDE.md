# CLAUDE.md — apps/back

> This file is the entry point for Claude Code working on the back-end.
> Read this FIRST, then read the linked docs before touching the relevant area.

## Golden Rules

1. **Optimize for accuracy over speed.** Never guess values, addresses, or formats. If unsure, ask Nadar.
2. **Never send 4000+ Jupiter tokens to an LLM prompt.** The curated asset list exists for a reason. See `docs/ASSET-PIPELINE.md`.
3. **Never arbitrarily add or remove tickers.** `curated-assets.ts` is a DERIVED file — its contents come from alias targets + mint lookups + stock dedup. See `docs/ASSET-PIPELINE.md` for inclusion criteria and source of truth. If a token is tradeable on Jupiter and is an alias target, it belongs in the curated list. No subjective filtering.
4. **One-time fixes must be removed after use.** No temporary workarounds in the codebase.
5. **Always include `prisma migrate deploy`** in the build script of `package.json`.
6. **Use cron jobs, not infinite loops.** 1-service architecture with embedded node-cron.
7. **Never assume zero fees for vaults.** Always explicitly set fee params.

## Architecture Overview

Read `docs/DATA-PIPELINE.md` for the full system flow diagram.

Quick summary: Tweets → Classify → Thesis → Rebalance → Swap

```
CRON_FETCH_TWEETS  →  Twitter API  →  Tweet table
CRON_RUN_ALGO      →  Classify (LLM) + Thesis (LLM)  →  PortfolioSnapshot
CRON_REBALANCE     →  Delta computation  →  Jupiter swaps via GLAM vault
CRON_FETCH_PRICES  →  Birdeye/Jupiter  →  TokenPrice table
```

## Key Documentation

| Doc | What it covers | Read before touching... |
|-----|----------------|------------------------|
| `docs/ASSET-PIPELINE.md` | Two-tier asset system (aliases vs curated), stock deduplication logic, how to add/remove assets | `curated-assets.ts`, `asset-aliases.json`, `sync-asset-aliases.ts`, `classifier.service.ts`, `thesis.service.ts` |
| `docs/DATA-PIPELINE.md` | Full data flow from tweet ingestion to vault rebalancing, every cron job, every service | Any cron job, any service file |

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **Framework**: Fastify
- **DB**: PostgreSQL via Prisma ORM
- **Scheduling**: node-cron (embedded, not separate Railway services)
- **LLM**: Claude Haiku via Anthropic API
- **Blockchain**: Solana (web3.js, GLAM SDK, Jupiter API)
- **Deploy**: Railway (single service)

## File Layout

```
src/
├── cron/           # Cron job entry points (thin wrappers calling services)
├── data/           # Static data files
│   ├── curated-assets.ts    # ~155 assets the thesis LLM can invest in
│   └── asset-aliases.json   # ~500 aliases for classifier normalization
├── scripts/        # One-off scripts (seed, sync, debug)
├── services/       # Business logic
│   ├── classifier.service.ts   # Tweet classification (uses aliases)
│   ├── thesis.service.ts       # Portfolio synthesis (uses curated assets)
│   ├── rebalancer.service.ts   # Vault rebalancing (uses Jupiter tradeableAssets)
│   └── ...
├── store/          # Prisma repository layer
├── solana/         # On-chain interaction (GLAM, Jupiter swaps)
└── utils/          # Shared utilities (logger, LLM client, env)
```

## Common Tasks

### Adding a new KOL
Run `seed-kols.ts` script. The algo picks them up automatically on next cron run.

### Adding a new asset
See `docs/ASSET-PIPELINE.md` § "How to Add an Asset". You need to update BOTH the aliases file AND curated-assets.ts.

### Running the algo for one KOL
```bash
set -a && source .env && set +a && pnpm --filter @repo/back exec tsx src/scripts/run-algo-one-kol.ts <username>
```

### Typecheck
```bash
pnpm --filter @repo/back typecheck
```
Note: Some pre-existing errors (ioredis, @fastify/websocket, bullmq types) are known.

## Reminders

- Update `FORNADAR.md` after changes.
- Update `README.md` when changes affect architecture, data sources, or constraints.
- Nadar deploys on Railway. Use env vars from `.env`.
- M2 MacBook with x86 Homebrew at `/usr/local` — use `arch -x86_64` for build issues.
- When creating GLAM vaults, always confirm token name/symbol with Nadar first.
