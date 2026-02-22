import { z } from "zod";

export const kolQuerySchema = z.object({
  active: z.enum(["true", "false"]).optional(),
});

export const kolIdParamSchema = z.object({
  id: z.string().min(1, "KOL ID is required"),
});
