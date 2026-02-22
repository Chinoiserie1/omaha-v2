import { z } from "zod";

const usernameRegex = /^[a-zA-Z0-9_]+$/;

export const checkUsernameSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(15, "Username must be 15 characters or less")
    .regex(usernameRegex, "Only letters, numbers, and underscores allowed"),
});

export const completeOnboardingSchema = z.object({
  privyId: z.string().min(1, "Privy ID is required"),
  email: z.string().email("Invalid email address").optional(),
  username: z
    .string()
    .min(1, "Username is required")
    .max(15, "Username must be 15 characters or less")
    .regex(usernameRegex, "Only letters, numbers, and underscores allowed"),
  twitterId: z.string().optional(),
  twitterUsername: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
  name: z.string().optional(),
});

export const updateUsernameSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(15, "Username must be 15 characters or less")
    .regex(usernameRegex, "Only letters, numbers, and underscores allowed"),
});
