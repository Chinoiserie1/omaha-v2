export interface KolVault {
  id: string;
  kolId: string;
  kolUsername: string;
  name: string;
  description: string;
  glamVaultPda: string | null;
  statePda: string;
  mintAddress: string | null;
  vaultName: string;
  vaultSymbol: string;
  isActive: boolean;
  jupiterEnabled: boolean;
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
  kolVaultId: string;
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
