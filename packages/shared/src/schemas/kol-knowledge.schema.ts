import { z } from "zod";

const DirectAllocationSchema = z.object({
  asset: z.string().min(1).max(20),
  percentage: z.number().min(0).max(100),
});

export const KolKnowledgeSchema = z.object({
  investmentStyle: z.string().max(500).optional(),
  notes: z.array(z.string().max(300)).max(20).optional(),
  useDirectAllocations: z.boolean().optional(),
  directAllocations: z
    .array(DirectAllocationSchema)
    .min(1)
    .max(30)
    .refine(
      (allocs) => {
        const sum = allocs.reduce((s, a) => s + a.percentage, 0);
        return sum >= 95 && sum <= 105;
      },
      { message: "Allocations must sum to ~100%" },
    )
    .optional(),
  directAllocationsSetAt: z.string().datetime().optional(),
});

export type KolKnowledge = z.infer<typeof KolKnowledgeSchema>;
