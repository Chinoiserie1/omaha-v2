export interface TokenBalance {
  mint: string;
  decimals: number;
  amount: string;
  uiAmount: number;
}

export interface WalletBalances {
  sol: number;
  tokens: TokenBalance[];
}

export interface PortfolioTokenItem {
  type: "token";
  name: string;
  symbol: string;
  mint: string;
  amount: number;
  decimals: number;
  programId?: string;
  usdPrice: number;
  valueUsd: number;
}

export interface PortfolioVaultItem {
  type: "vault";
  name: string;
  vaultId: string;
  shares: number;
  sharePrice: number;
  valueUsd: number;
}

export type PortfolioItem = PortfolioTokenItem | PortfolioVaultItem;

export interface WalletPortfolio {
  totalUsd: number;
  items: PortfolioItem[];
}

export type PortfolioChartPeriod = "1d" | "7d" | "30d" | "all";

export interface PortfolioChartPoint {
  timestamp: number;
  value: number;
}

export interface PortfolioChartResponse {
  period: PortfolioChartPeriod;
  points: PortfolioChartPoint[];
  currentValue: number | null;
  startValue: number | null;
  percentChange: number | null;
}

export interface ActiveThesisItem {
  vaultId: string;
  name: string;
  quantUsername: string | null;
  assetCount: number;
  shares: number;
  sharePrice: number;
  valueUsd: number;
  pnlAmount: number;
  pnlPercent: number;
}
