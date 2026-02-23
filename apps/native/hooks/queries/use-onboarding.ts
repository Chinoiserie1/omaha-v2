import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface OnboardingStatus {
  onboardingCompleted: boolean;
}

interface UsernameCheck {
  available: boolean;
}

interface OnboardingData {
  privyId: string;
  username?: string;
  twitterId?: string;
  twitterUsername?: string;
  profileImageUrl?: string;
  name?: string;
}

export function useOnboardingStatus(privyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.onboarding.status(privyId ?? ""),
    queryFn: () =>
      apiClient.get<OnboardingStatus>(
        `/api/onboarding/status?privyId=${encodeURIComponent(privyId!)}`,
      ),
    enabled: !!privyId,
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: OnboardingData) =>
      apiClient.post("/api/onboarding/complete", data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.status(variables.privyId),
      });
    },
  });
}

export function useCheckUsername(username: string) {
  return useQuery({
    queryKey: queryKeys.username.check(username),
    queryFn: () =>
      apiClient.post<UsernameCheck>("/api/onboarding/check-username", {
        username,
      }),
    enabled: username.length > 0,
  });
}
