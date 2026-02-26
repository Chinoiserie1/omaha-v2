import "../global.css";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PrivyProvider } from "@privy-io/expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider, usePostHog } from "posthog-react-native";
import Constants from "expo-constants";
import { useColorScheme } from "nativewind";
import Toast from "react-native-toast-message";
import { posthogConfig } from "../lib/posthog";
import { PostHogErrorBoundary } from "../components/shared/PostHogErrorBoundary";

const PRIVY_APP_ID =
  Constants.expoConfig?.extra?.privyAppId ?? process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_CLIENT_ID =
  Constants.expoConfig?.extra?.privyClientId ?? process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? "";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function FlushOnBackground() {
  const posthog = usePostHog();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const handler = (nextState: AppStateStatus) => {
      if (appState.current === "active" && nextState.match(/inactive|background/)) {
        posthog?.flush();
      }
      appState.current = nextState;
    };

    const subscription = AppState.addEventListener("change", handler);
    return () => subscription.remove();
  }, [posthog]);

  return null;
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (!PRIVY_APP_ID || !PRIVY_CLIENT_ID) {
    console.error("[_layout] Privy credentials are missing!");
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PostHogProvider
        apiKey={posthogConfig.apiKey}
        options={posthogConfig.options}
        autocapture={posthogConfig.autocapture}
        debug={posthogConfig.debug}
      >
        <PostHogErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <PrivyProvider
              appId={PRIVY_APP_ID}
              clientId={PRIVY_CLIENT_ID}
              config={{
                embedded: {
                  solana: {
                    createOnLogin: "users-without-wallets",
                  },
                },
              }}
            >
              <FlushOnBackground />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: isDark ? "#09090B" : "#FFFFFF" },
                }}
              >
                <Stack.Screen name="index" options={{ animation: "none" }} />
                <Stack.Screen
                  name="(onboarding)"
                  options={{ animation: "fade_from_bottom" }}
                />
                <Stack.Screen name="(app)" options={{ animation: "fade" }} />
              </Stack>
              <StatusBar style={isDark ? "light" : "dark"} />
              <Toast />
            </PrivyProvider>
          </QueryClientProvider>
        </PostHogErrorBoundary>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}
