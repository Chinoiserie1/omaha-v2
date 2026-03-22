export interface User {
  id: string;
  privyId: string | null;
  email: string | null;
  username: string | null;
  name: string | null;
  twitterId: string | null;
  twitterUsername: string | null;
  profileImageUrl: string | null;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export * from "./kol.js";
export * from "./tweet.js";
export * from "./portfolio.js";
export * from "./vault.js";
export * from "./follow.js";
export * from "./wallet.js";
export * from "./tweet-impact.js";
export * from "./withdrawal.js";
export * from "./vault-favorite.js";
export * from "./fund-sol.js";
export * from "./explore.js";
