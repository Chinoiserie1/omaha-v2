/**
 * Asset equivalence groups for the thesis LLM.
 *
 * The LLM treats members of each group as a single exposure class.
 * This prevents double-counting (e.g. SOL + JitoSOL = 2x SOL exposure).
 */

interface AssetGroup {
  name: string;
  members: string[];
  defaultAsset: string;
  rule: string;
}

const ASSET_GROUPS: AssetGroup[] = [
  {
    name: "SOL Exposure (Liquid Staking Tokens)",
    members: ["SOL", "JitoSOL", "mSOL", "bSOL", "JupSOL", "hSOL", "INF", "LST"],
    defaultAsset: "SOL",
    rule: "These are ALL forms of SOL exposure. JitoSOL, mSOL, bSOL, JupSOL, hSOL, INF, and LST are liquid staking tokens (LSTs) that represent staked SOL plus yield. NEVER allocate to both SOL and an LST — that is double-counting the same exposure. If the KOL specifically mentions an LST (e.g. 'I hold JitoSOL'), allocate to that LST. If the KOL just says 'SOL' or 'Solana', allocate to SOL. Pick ONE from this group per position.",
  },
  {
    name: "USD Stablecoins",
    members: ["USDC", "USDT", "PYUSD"],
    defaultAsset: "USDC",
    rule: "These are all USD-pegged stablecoins. Use USDC as the default for cash/stablecoin positions. Only use USDT or PYUSD if the KOL explicitly distinguishes between them. NEVER split an allocation across multiple stablecoins unless the KOL explicitly says so.",
  },
  {
    name: "BTC Exposure",
    members: ["cbBTC"],
    defaultAsset: "cbBTC",
    rule: "cbBTC is wrapped Bitcoin on Solana. When the KOL mentions BTC or Bitcoin, allocate to cbBTC (the only investable BTC wrapper in the available assets). Treat all BTC mentions as one position.",
  },
];

export function getAssetGroupRules(): string {
  return ASSET_GROUPS.map((group) => {
    const memberList = group.members.join(", ");
    return `${group.name} [${memberList}]:\n${group.rule}`;
  }).join("\n\n");
}
