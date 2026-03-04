export interface FundSolQuote {
  amountUsd: number;
  inputAmountUsdc: number;
  outputAmountSol: number;
  platformFeeUsdc: number;
  platformFeePct: number;
}

export interface FundSolResponse {
  transaction: string;
  quote: FundSolQuote;
}
