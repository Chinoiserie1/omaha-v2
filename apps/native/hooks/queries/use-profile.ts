import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface ProfileData {
  id: string;
  username: string | null;
  name: string | null;
  twitterUsername: string | null;
  profileImageUrl: string | null;
  followersCount: number;
  followingCount: number;
  quantId: string | null;
}

interface SyncTwitterData {
  twitterId: string;
  twitterUsername?: string | undefined;
  profileImageUrl?: string | undefined;
  name?: string | undefined;
}

export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: () => apiClient.get<ProfileData>("/api/profile/me"),
  });
}

export function useSyncTwitter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SyncTwitterData) =>
      apiClient.patch("/api/profile/sync-twitter", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
    },
  });
}
