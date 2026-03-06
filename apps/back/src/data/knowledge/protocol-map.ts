/**
 * Protocol/project context for the thesis LLM.
 *
 * Maps protocol names that appear in KOL tweets to their actual meaning,
 * so the LLM doesn't create phantom positions in non-investable tokens.
 */

interface ProtocolEntry {
  description: string;
  investable: boolean;
  relatedToken?: string;
  note: string;
}

const PROTOCOL_MAP: Record<string, ProtocolEntry> = {
  BAM: {
    description: "Jito Block Engine / MEV framework on Solana",
    investable: false,
    relatedToken: "JTO",
    note: "BAM is NOT a token. Mentions of BAM = bullish on Jito ecosystem. Allocate to JTO instead.",
  },
  Marinade: {
    description: "Liquid staking protocol on Solana",
    investable: true,
    relatedToken: "MNDE",
    note: "Marinade's token is MNDE. Its staking product mSOL is SOL exposure (see SOL Exposure group). If KOL is bullish on Marinade the protocol, allocate to MNDE. If they mention mSOL staking yield, allocate to mSOL.",
  },
  Jito: {
    description: "MEV/restaking protocol on Solana",
    investable: true,
    relatedToken: "JTO",
    note: "Jito's token is JTO. Its staking product JitoSOL is SOL exposure (see SOL Exposure group). If KOL is bullish on Jito the protocol/MEV, allocate to JTO. If they mention JitoSOL for staking yield, allocate to JitoSOL.",
  },
  PiggyBank: {
    description: "Stablecoin yield protocol on Solana",
    investable: false,
    relatedToken: "USDC",
    note: "PiggyBank is a yield protocol, not a token. Mentions relate to USDC yield strategies. Do not create a PiggyBank position — allocate to USDC.",
  },
  Sanctum: {
    description: "LST infrastructure protocol on Solana",
    investable: false,
    relatedToken: "INF",
    note: "Sanctum enables LST creation and swaps. Its flagship LST is INF. Mentions of Sanctum = bullish on LST ecosystem. Allocate to INF if they mention Sanctum staking.",
  },
};

export function getProtocolContextRules(): string {
  const entries = Object.entries(PROTOCOL_MAP).map(([name, entry]) => {
    const investableTag = entry.investable ? "investable" : "NOT investable";
    const related = entry.relatedToken ? ` → allocate to ${entry.relatedToken}` : "";
    return `${name} (${entry.description}, ${investableTag}${related}):\n${entry.note}`;
  });
  return entries.join("\n\n");
}
