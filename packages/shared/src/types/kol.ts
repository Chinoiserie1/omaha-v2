export interface Kol {
  id: string;
  username: string;
  displayName: string | null;
  restId: string | null;
  followersCount: number | null;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  lastFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KolWithStats extends Kol {
  tweetCount: number;
}
