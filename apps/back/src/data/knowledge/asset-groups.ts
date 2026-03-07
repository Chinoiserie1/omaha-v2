/**
 * Asset equivalence groups for the thesis LLM.
 *
 * The LLM treats members of each group as a single exposure class.
 * This prevents double-counting (e.g. SOL + JitoSOL = 2x SOL exposure).
 */

import type { Allocation } from "@repo/shared";

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

const CONVICTION_RANK: Record<string, number> = {
  stale: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Post-LLM enforcement: merge allocations that belong to the same asset group.
 *
 * If the LLM returns e.g. SOL 35% + JitoSOL 15%, this merges them into
 * JitoSOL 50% (preferring the non-default / highest-% member).
 */
export function mergeAssetGroupAllocations(allocations: Allocation[]): Allocation[] {
  // Build lookup: symbol → group
  const symbolToGroup = new Map<string, AssetGroup>();
  for (const group of ASSET_GROUPS) {
    for (const member of group.members) {
      symbolToGroup.set(member, group);
    }
  }

  // Bucket allocations by group name (ungrouped pass through)
  const grouped = new Map<string, Allocation[]>();
  const ungrouped: Allocation[] = [];

  for (const alloc of allocations) {
    const group = symbolToGroup.get(alloc.asset);
    if (group) {
      const bucket = grouped.get(group.name);
      if (bucket) {
        bucket.push(alloc);
      } else {
        grouped.set(group.name, [alloc]);
      }
    } else {
      ungrouped.push(alloc);
    }
  }

  const result: Allocation[] = [...ungrouped];

  for (const [groupName, bucket] of grouped) {
    if (bucket.length === 1) {
      result.push(bucket[0]!);
      continue;
    }

    // Find the group definition to know the default asset
    const groupDef = ASSET_GROUPS.find((g) => g.name === groupName)!;

    // Winner: prefer non-default member; among non-defaults pick highest %
    const nonDefault = bucket.filter((a) => a.asset !== groupDef.defaultAsset);
    const candidates = nonDefault.length > 0 ? nonDefault : bucket;
    const winner = candidates.reduce((best, cur) =>
      cur.percentage > best.percentage ? cur : best
    );

    const others = bucket.filter((a) => a !== winner);
    const mergedNote = others
      .map((a) => `${a.asset} ${a.percentage}%`)
      .join(", ");

    const merged: Allocation = {
      asset: winner.asset,
      ...(winner.mint ? { mint: winner.mint } : {}),
      percentage: bucket.reduce((sum, a) => sum + a.percentage, 0),
      conviction: bucket.reduce((best, cur) =>
        (CONVICTION_RANK[cur.conviction] ?? 0) > (CONVICTION_RANK[best.conviction] ?? 0) ? cur : best
      ).conviction,
      reasoning: `${winner.reasoning} (merged with ${mergedNote})`,
      since: bucket.reduce((earliest, cur) =>
        cur.since < earliest ? cur.since : earliest, bucket[0]!.since),
      lastSignal: bucket.reduce((latest, cur) =>
        cur.lastSignal > latest ? cur.lastSignal : latest, bucket[0]!.lastSignal),
    };

    result.push(merged);
  }

  return result;
}
