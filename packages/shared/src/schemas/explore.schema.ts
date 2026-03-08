import { z } from "zod";

export const exploreSearchQuerySchema = z.object({
  asset: z.string().min(1, "Asset symbol is required"),
  limit: z.coerce.number().int().positive().max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const assetAutocompleteQuerySchema = z.object({
  q: z.string().min(1, "Query is required"),
});
