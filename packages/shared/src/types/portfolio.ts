export interface Allocation {
  asset: string;
  mint?: string;
  percentage: number;
  conviction: "low" | "medium" | "high" | "stale";
  reasoning: string;
  since: string;
  lastSignal: string;
}

export interface PortfolioSnapshot {
  id: string;
  kolId: string;
  thesisSummary: string;
  allocations: Allocation[];
  changes: string[];
  sourceTweetIds: string[];
  createdAt: Date;
}
