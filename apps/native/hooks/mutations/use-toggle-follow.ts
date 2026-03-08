import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface FollowStatus {
  isFollowing: boolean;
}

export function useToggleFollow(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.follows.status(userId);

  return useMutation({
    mutationFn: async () => {
      const current = queryClient.getQueryData<FollowStatus>(queryKey);
      if (current?.isFollowing) {
        await apiClient.post("/api/follows/unfollow", {
          followingId: userId,
        });
      } else {
        await apiClient.post("/api/follows/follow", {
          followingId: userId,
        });
      }
    },

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<FollowStatus>(queryKey);

      queryClient.setQueryData<FollowStatus>(queryKey, (old) => ({
        isFollowing: !old?.isFollowing,
      }));

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
