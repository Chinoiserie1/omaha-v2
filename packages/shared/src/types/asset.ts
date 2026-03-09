export interface TradeableAsset {
  id: string;
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoUri: string | null;
  isActive: boolean;
}
