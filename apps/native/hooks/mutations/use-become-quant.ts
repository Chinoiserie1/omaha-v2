import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface BecomeQuantResponse {
  quantId: string;
}

export function useBecomeQuant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<BecomeQuantResponse>("/api/quants/become"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
    },
  });
}
