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
