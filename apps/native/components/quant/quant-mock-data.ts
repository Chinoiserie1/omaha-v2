import type { Allocation } from "@repo/shared";

export type MockQuantState =
  | "not-quant"
  | "quant-no-strategy"
  | "quant-with-strategy"
  | "quant-with-vault";

export const MOCK_THESIS =
  "Overweight SOL ecosystem with high conviction on infrastructure plays. " +
  "Maintaining BTC and ETH as core positions while rotating into high-beta " +
  "Solana DeFi tokens. Reduced meme exposure after recent volatility.";

export const MOCK_ALLOCATIONS: Allocation[] = [
  {
    asset: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    percentage: 35,
    conviction: "high",
    reasoning: "L1 dominance with strong DeFi growth",
    since: "2026-01-15",
    lastSignal: "2026-03-05",
  },
  {
    asset: "BTC",
    mint: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
    percentage: 25,
    conviction: "high",
    reasoning: "Store of value, macro hedge",
    since: "2025-11-01",
    lastSignal: "2026-03-01",
  },
  {
    asset: "ETH",
    mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    percentage: 20,
    conviction: "medium",
    reasoning: "L2 ecosystem expanding but competition rising",
    since: "2025-12-10",
    lastSignal: "2026-02-28",
  },
  {
    asset: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    percentage: 12,
    conviction: "high",
    reasoning: "Dominant DEX aggregator on Solana",
    since: "2026-02-01",
    lastSignal: "2026-03-06",
  },
  {
    asset: "RAY",
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    percentage: 8,
    conviction: "medium",
    reasoning: "Leading AMM, benefits from Solana DeFi volume",
    since: "2026-02-15",
    lastSignal: "2026-03-04",
  },
];

export const MOCK_PERFORMANCE = {
  currentValue: 12_487.32,
  change24h: 3.42,
  change7d: -1.85,
  change30d: 15.67,
  changeAll: 24.87,
};

export const MOCK_VAULT = {
  id: "vault-001",
  name: "SOL Alpha Vault",
  symbol: "SALPHA",
  statePda: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  totalEquityUsd: 48_250.0,
  holdingsCount: 5,
  isActive: true,
  lastRebalancedAt: "2026-03-06T14:30:00Z",
};

export const MOCK_STRATEGY_UPDATED_AT = "2026-03-07T10:00:00Z";
