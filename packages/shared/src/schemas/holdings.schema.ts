import { z } from "zod";

export const vaultHoldingWithPctSchema = z.object({
  mint: z.string(),
  symbol: z.string(),
  uiAmount: z.number(),
  price: z.number(),
  valueUsd: z.number(),
  percentage: z.number(),
});

export const vaultHoldingsResponseSchema = z.object({
  holdings: z.array(vaultHoldingWithPctSchema),
  totalEquityUsd: z.number(),
  snapshotId: z.string(),
  snapshotDate: z.string(),
});
