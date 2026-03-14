export interface Vault {
  id: string;
  quantId: string;
  statePda: string;
  shareMint: string | null;
  baseTokenAta: string | null;
  mintAddress: string | null;
  vaultName: string;
  vaultSymbol: string;
  isActive: boolean;
  about: string;
  dataSource: string;
  performanceCalc: string;
  disclosure: string;
  lastRebalancedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultHolding {
  mint: string;
  symbol: string;
  uiAmount: number;
  price: number;
  valueUsd: number;
}

export interface VaultHoldingWithPct extends VaultHolding {
  percentage: number;
}

export interface VaultHoldingsResponse {
  holdings: VaultHoldingWithPct[];
  totalEquityUsd: number;
  snapshotId: string;
  snapshotDate: string;
}

export interface SwapDelta {
  asset: string;
  mint: string;
  direction: "sell" | "buy";
  currentPct: number;
  targetPct: number;
  deltaPct: number;
  deltaUsd: number;
  txSig?: string;
  error?: string;
}

export interface VaultPerformancePoint {
  timestamp: number;
  value: number;
}

export type VaultPerformancePeriod = "1d" | "7d" | "30d" | "all";

export interface VaultPerformanceResponse {
  period: VaultPerformancePeriod;
  points: VaultPerformancePoint[];
  currentPrice: number | null;
  startPrice: number | null;
  percentChange: number | null;
}

export type RebalanceStatus =
  | "PENDING"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "DRY_RUN";

export interface RebalanceEvent {
  id: string;
  vaultId: string;
  snapshotId: string;
  status: string;
  sellCount: number;
  buyCount: number;
  totalSwaps: number;
  swapDetails: unknown;
  vaultEquityUsd: number | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}
