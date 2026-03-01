import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePrivy, useCreateGuestAccount } from "@privy-io/expo";
import { AnimatedLogo } from "../components/landing/AnimatedLogo";
import { HeroCard } from "../components/landing/HeroCard";
import { GradientBackground } from "../components/shared/GradientBackground";
import { TwitterLoginButton } from "../components/onboarding/TwitterLoginButton";
import { useCompleteOnboarding } from "../hooks/queries/use-onboarding";
import { useAuth } from "../contexts/auth-context";
import { ApiError } from "../lib/api-client";
import { showErrorToast } from "../lib/show-error-toast";

interface OnboardingData {
  privyId: string;
  username?: string;
  twitterId?: string;
  twitterUsername?: string;
  profileImageUrl?: string;
  name?: string;
}

function buildOnboardingData(
  privyId: string,
  twitter?: {
    username?: string | undefined;
    id?: string | undefined;
    profileImageUrl?: string | undefined;
    name?: string | undefined;
  },
): OnboardingData {
  const data: OnboardingData = { privyId };
  if (twitter?.username) {
    data.username = twitter.username;
    data.twitterUsername = twitter.username;
  }
  if (twitter?.id) data.twitterId = twitter.id;
  if (twitter?.profileImageUrl) data.profileImageUrl = twitter.profileImageUrl;
  if (twitter?.name) data.name = twitter.name;
  return data;
}

export default function LandingScreen() {
  const { status } = useAuth();
  const { user } = usePrivy();
  const guest = useCreateGuestAccount();
  const router = useRouter();
  const didRedirectToApp = useRef(false);
  const hasNavigated = useRef(false);
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastDataRef = useRef<OnboardingData | null>(null);

  const mutation = useCompleteOnboarding();

  // Redirect to app if already authenticated
  useEffect(() => {
    if (status === "authenticated" && !didRedirectToApp.current) {
      didRedirectToApp.current = true;
      router.replace("/(app)/(tabs)/(home)");
    }
    if (status === "unauthenticated") {
      didRedirectToApp.current = false;
      hasNavigated.current = false;
    }
  }, [status, router]);

  const completeOnboarding = (data: OnboardingData) => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    setError(null);
    lastDataRef.current = data;

    mutation.mutate(data, {
      onSuccess: () => {
        router.replace("/(app)/(tabs)/(home)" as const);
      },
      onError: (err) => {
        hasNavigated.current = false;
        setIsCreatingGuest(false);
        showErrorToast("Login Failed", err);
        if (err instanceof ApiError) {
          const body = err.body as Record<string, string> | null;
          setError(body?.error ?? "Something went wrong. Please try again.");
        } else {
          setError("Network error. Please try again.");
        }
      },
    });
  };

  const handleRetry = () => {
    if (lastDataRef.current) {
      completeOnboarding(lastDataRef.current);
    }
  };

  // Auto-complete onboarding when user authenticates via Twitter
  useEffect(() => {
    if (!user || hasNavigated.current) return;

    const twitterAccount = user.linked_accounts?.find(
      (account) => account.type === "twitter_oauth",
    );

    if (twitterAccount) {
      const rawUsername =
        "username" in twitterAccount ? twitterAccount.username : undefined;
      const twitterId = twitterAccount.subject;
      const rawProfileImageUrl =
        "profile_picture_url" in twitterAccount
          ? (twitterAccount as unknown as Record<string, string>)[
              "profile_picture_url"
            ]
          : undefined;
      const rawName =
        "name" in twitterAccount ? twitterAccount.name : undefined;
      completeOnboarding(
        buildOnboardingData(user.id, {
          username: rawUsername ? String(rawUsername) : undefined,
          id: twitterId,
          profileImageUrl: rawProfileImageUrl
            ? String(rawProfileImageUrl)
            : undefined,
          name: rawName ? String(rawName) : undefined,
        }),
      );
    } else {
      // Guest or other auth method — complete without Twitter
      completeOnboarding({ privyId: user.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleTwitterSuccess = (twitterData: {
    privyId: string;
    twitterUsername?: string;
    twitterId?: string;
    profileImageUrl?: string;
    name?: string;
  }) => {
    if (hasNavigated.current) return;
    completeOnboarding(
      buildOnboardingData(twitterData.privyId, {
        username: twitterData.twitterUsername,
        id: twitterData.twitterId,
        profileImageUrl: twitterData.profileImageUrl,
        name: twitterData.name,
      }),
    );
  };

  const handleGuestLogin = async () => {
    setIsCreatingGuest(true);
    try {
      const result = await guest.create();
      const privyId = result?.id;
      if (privyId) {
        completeOnboarding({ privyId });
      } else {
        showErrorToast(
          "Guest Login Failed",
          new Error("Account created but no user ID returned"),
        );
        setIsCreatingGuest(false);
      }
    } catch (err) {
      showErrorToast("Guest Login Failed", err);
      setIsCreatingGuest(false);
    }
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0070FF" />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo */}
          <AnimatedLogo />

          {/* Hero Card */}
          <View style={styles.heroContainer}>
            <HeroCard />
          </View>

          {/* Heading + Description */}
          <Text style={styles.heading}>
            Copy-Trade the{"\n"}Best KOLs on Solana
          </Text>
          <Text style={styles.description}>
            Automatically mirror top crypto influencer trades with one tap.
          </Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TwitterLoginButton
              onSuccess={handleTwitterSuccess}
              onError={(err) => showErrorToast("Twitter Login Failed", err)}
            />

            {error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetry}
                  activeOpacity={0.8}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.guestButton}
              onPress={handleGuestLogin}
              disabled={isCreatingGuest}
              activeOpacity={0.6}
            >
              {isCreatingGuest ? (
                <ActivityIndicator color="#64748B" />
              ) : (
                <Text style={styles.guestButtonText}>Continue as Guest</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  heroContainer: {
    marginTop: 32,
    marginBottom: 28,
  },
  heading: {
    color: "#FFFFFF",
    fontSize: 32,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
    lineHeight: 40,
  },
  description: {
    color: "#CBD5E1",
    fontSize: 16,
    fontFamily: "SpaceGrotesk_400Regular",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  buttonsContainer: {
    width: "100%",
    marginTop: 32,
    gap: 12,
  },
  errorCard: {
    padding: 16,
    backgroundColor: "rgba(127,29,29,0.5)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_400Regular",
    textAlign: "center",
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#0070FF",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_600SemiBold",
  },
  guestButton: {
    paddingVertical: 12,
  },
  guestButtonText: {
    color: "#94A3B8",
    fontSize: 16,
    fontFamily: "SpaceGrotesk_400Regular",
    textAlign: "center",
  },
  footerText: {
    color: "#64748B",
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
    textAlign: "center",
    marginTop: 20,
  },
});
