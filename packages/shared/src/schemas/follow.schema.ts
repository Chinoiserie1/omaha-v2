import { z } from "zod";

export const followUserSchema = z.object({
  followingId: z.string().min(1, "Following ID is required"),
});

export const unfollowUserSchema = z.object({
  followingId: z.string().min(1, "Following ID is required"),
});

export const followListQuerySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const followCountsQuerySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const followStatusQuerySchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
});
