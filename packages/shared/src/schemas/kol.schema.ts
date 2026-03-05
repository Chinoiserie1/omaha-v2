import { z } from "zod";

export const quantQuerySchema = z.object({
  active: z.enum(["true", "false"]).optional(),
});

export const quantIdParamSchema = z.object({
  id: z.string().min(1, "Quant ID is required"),
});
