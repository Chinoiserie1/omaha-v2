export interface Allocation {
  asset: string;
  mint?: string;
  logoUri?: string;
  percentage: number;
  conviction: "low" | "medium" | "high" | "stale";
  reasoning: string;
  since: string;
  lastSignal: string;
}

export interface PortfolioSnapshot {
  id: string;
  quantId: string;
  thesisSummary: string;
  allocations: Allocation[];
  changes: string[];
  sourceTweetIds: string[];
  createdAt: Date;
}
