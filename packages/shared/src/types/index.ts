export interface User {
  id: string;
  privyId: string;
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
