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
