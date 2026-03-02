export type PerformancePeriod = "1D" | "1W" | "1M";

export interface ActiveThesis {
  id: string;
  name: string;
  kolUsername: string;
  assetCount: number;
  pnlAmount: number;
  pnlPercent: number;
}

interface DataPoint {
  timestamp: number;
  value: number;
}

export const MOCK_DAILY_CHANGE_PERCENT = 2.34;

function generatePoints(
  count: number,
  baseValue: number,
  variance: number,
): DataPoint[] {
  const now = Date.now();
  const interval = (24 * 60 * 60 * 1000) / count;

  let value = baseValue;
  return Array.from({ length: count }, (_, i) => {
    value += (Math.random() - 0.45) * variance;
    return { timestamp: now - (count - i) * interval, value: Math.max(0, value) };
  });
}

export const MOCK_PERFORMANCE_DATA: Record<PerformancePeriod, DataPoint[]> = {
  "1D": generatePoints(24, 1200, 15),
  "1W": generatePoints(7 * 24, 1100, 12),
  "1M": generatePoints(30, 950, 25),
};

export const MOCK_ACTIVE_THESES: ActiveThesis[] = [
  {
    id: "1",
    name: "AI Narrative Play",
    kolUsername: "CryptoWizardd",
    assetCount: 4,
    pnlAmount: 342.5,
    pnlPercent: 12.8,
  },
  {
    id: "2",
    name: "DeFi Blue Chips",
    kolUsername: "DefiDegen_",
    assetCount: 3,
    pnlAmount: -89.2,
    pnlPercent: -3.4,
  },
  {
    id: "3",
    name: "Solana Ecosystem",
    kolUsername: "SolanaLegend",
    assetCount: 5,
    pnlAmount: 1205.0,
    pnlPercent: 28.6,
  },
];
