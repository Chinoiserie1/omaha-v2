export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

export interface FollowCounts {
  followersCount: number;
  followingCount: number;
}

export interface FollowStatus {
  isFollowing: boolean;
}

export interface FollowerUser {
  id: string;
  username: string | null;
  name: string | null;
  profileImageUrl: string | null;
}
