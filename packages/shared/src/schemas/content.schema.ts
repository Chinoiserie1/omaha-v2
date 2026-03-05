import { z } from "zod";

export const CONTENT_SOURCES = [
  "x",
  "reddit",
  "substack",
  "blog",
  "dm",
  "telegram",
  "discord",
] as const;

export const ingestContentSchema = z
  .object({
    quantId: z.string().min(1).optional(),
    quantUsername: z.string().min(1).optional(),
    text: z.string().min(1, "text is required"),
    source: z.enum(CONTENT_SOURCES),
    sourceUrl: z.string().url().optional(),
    postedAt: z.coerce.date().optional(),
  })
  .refine((d) => d.quantId !== undefined || d.quantUsername !== undefined, {
    message: "Either quantId or quantUsername must be provided",
  });
