import { z } from "zod";

export const KolKnowledgeSchema = z.object({
  investmentStyle: z.string().max(500).optional(),
  notes: z.array(z.string().max(300)).max(20).optional(),
});

export type KolKnowledge = z.infer<typeof KolKnowledgeSchema>;
