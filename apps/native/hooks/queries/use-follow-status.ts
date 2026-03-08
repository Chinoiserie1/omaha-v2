import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import { useAuth } from "../../contexts/auth-context";

interface FollowStatus {
  isFollowing: boolean;
}

export function useFollowStatus(userId: string) {
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";

  return useQuery({
    queryKey: queryKeys.follows.status(userId),
    queryFn: () =>
      apiClient.get<FollowStatus>(
        `/api/follows/status?targetUserId=${encodeURIComponent(userId)}`,
      ),
    enabled: !!userId && isAuthenticated,
  });
}
