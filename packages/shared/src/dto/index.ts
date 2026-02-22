import type { z } from "zod";
import type {
  createUserSchema,
  updateUserSchema,
  userResponseSchema,
  paginationSchema,
  checkUsernameSchema,
  completeOnboardingSchema,
  updateUsernameSchema,
} from "../schemas/index.js";

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UserResponseDto = z.infer<typeof userResponseSchema>;
export type PaginationDto = z.infer<typeof paginationSchema>;
export type CheckUsernameDto = z.infer<typeof checkUsernameSchema>;
export type CompleteOnboardingDto = z.infer<typeof completeOnboardingSchema>;
export type UpdateUsernameDto = z.infer<typeof updateUsernameSchema>;

// KOL Pipeline DTOs
import type {
  kolQuerySchema,
  createTweetByUrlSchema,
  tweetQuerySchema,
  portfolioHistoryQuerySchema,
  AllocationSchema,
  PortfolioOutputSchema,
} from "../schemas/index.js";

export type KolQueryDto = z.infer<typeof kolQuerySchema>;
export type CreateTweetByUrlDto = z.infer<typeof createTweetByUrlSchema>;
export type TweetQueryDto = z.infer<typeof tweetQuerySchema>;
export type PortfolioHistoryQueryDto = z.infer<typeof portfolioHistoryQuerySchema>;
export type AllocationDto = z.infer<typeof AllocationSchema>;
export type PortfolioOutputDto = z.infer<typeof PortfolioOutputSchema>;
