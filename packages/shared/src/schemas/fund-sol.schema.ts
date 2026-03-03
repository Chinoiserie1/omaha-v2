import { z } from "zod";

export const fundSolRequestSchema = z.object({
  amountUsd: z.number().int().min(1).max(10),
  signerPublicKey: z.string().min(1),
});
