import { z } from "zod";

export const createUserSchema = z.object({
  privyId: z.string().min(1, "Privy ID is required"),
  email: z.string().email("Invalid email address").optional(),
  name: z.string().min(1, "Name is required").optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  name: z.string().min(1, "Name must not be empty").optional(),
  username: z
    .string()
    .min(1, "Username is required")
    .max(15, "Username must be 15 characters or less")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed")
    .optional(),
});

export const userResponseSchema = z.object({
  id: z.string(),
  privyId: z.string(),
  email: z.string().email().nullable(),
  username: z.string().nullable(),
  name: z.string().nullable(),
  twitterId: z.string().nullable(),
  twitterUsername: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  onboardingCompleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
});

export const idParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export * from "./onboarding.js";
export * from "./kol.schema.js";
export * from "./tweet.schema.js";
export * from "./portfolio.schema.js";
export * from "./classification.schema.js";
export * from "./follow.schema.js";
export * from "./wallet.schema.js";
export * from "./holdings.schema.js";
export * from "./tweet-impact.schema.js";
export * from "./content.schema.js";
export * from "./withdrawal.schema.js";
