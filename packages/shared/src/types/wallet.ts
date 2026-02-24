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
