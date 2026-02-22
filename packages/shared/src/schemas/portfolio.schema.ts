import { z } from "zod";

export const AllocationSchema = z.object({
  asset: z.string(),
  mint: z.string().optional(),
  percentage: z.number(),
  conviction: z.enum(["low", "medium", "high", "stale"]),
  reasoning: z.string(),
  since: z.string(),
  lastSignal: z.string(),
});

export const PortfolioOutputSchema = z.object({
  kol: z.string(),
  thesisSummary: z.string(),
  allocations: z.array(AllocationSchema),
  changes: z.array(z.string()),
});

export const portfolioHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});
