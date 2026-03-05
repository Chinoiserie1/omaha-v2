export interface Quant {
  id: string;
  userId: string;
  isActive: boolean;
  algoEnabled: boolean;
  lastFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuantWithStats extends Quant {
  tweetCount: number;
}
