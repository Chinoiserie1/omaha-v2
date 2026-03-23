## What This Project Does

Omaha is a Quant strategy platform for crypto, stocks and commodities that uses Solana rails. It is a mobile App on Solana Seeker, Android and IOS. It monitors Twitter influencers (Quants), analyzes their trading signals, backtests portfolio strategies, and manages tokenized vaults on Solana via Omaha Vault. Users can browse Quant dashboards showing portfolios, significant tweets, and backtest results. Users can also become Quant creators and manage their own vaults.

### Key Concepts

- **User** — An app user (real or placeholder). Real users authenticate via Privy/Twitter. Placeholder users are created for Quants who haven't signed up yet.
- **Quant** — A strategy profile linked to a User. Holds pipeline config (isActive, algoEnabled) and owns tweets, portfolio snapshots, and optionally a vault.
- **Vault** — A tokenized vault on Solana (Omaha Vault program) owned by a Quant. Manages on-chain allocations based on the Quant's strategy. Has a 1:1 relation to a `Token` (share token) via `Vault.shareToken`.
- **Token** — A tradeable asset with on-chain mint address and metadata (decimals, logoUri). When `isVault=true`, it represents a vault's share token; otherwise it's a curated asset for portfolio allocations.

---

## FORNADAR.md Protocol

After completing any significant task (new feature, bug fix, architecture change):
1. Check if FORNADAR.md exists at project root
2. If not, create it following the template below
3. If yes, append/update the relevant sections

Sections required:
- What this project does (plain language)
- Technical architecture & how parts connect
- Tech stack & why these choices
- Bugs encountered & how they were fixed
- Lessons learned & best practices