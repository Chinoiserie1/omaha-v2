import { z } from "zod";

export const significantTweetsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  asset: z.string().optional(),
  impactType: z
    .enum(["new_position", "increase", "decrease", "exit", "reinforcement"])
    .optional(),
  minScore: z.coerce.number().min(0).optional(),
});
