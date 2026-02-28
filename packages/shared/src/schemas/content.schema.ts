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
    kolId: z.string().min(1).optional(),
    kolUsername: z.string().min(1).optional(),
    text: z.string().min(1, "text is required"),
    source: z.enum(CONTENT_SOURCES),
    sourceUrl: z.string().url().optional(),
    postedAt: z.coerce.date().optional(),
  })
  .refine((d) => d.kolId !== undefined || d.kolUsername !== undefined, {
    message: "Either kolId or kolUsername must be provided",
  });
