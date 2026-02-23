import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PrivyProvider } from "@privy-io/expo";
import Constants from "expo-constants";
import { useColorScheme } from "nativewind";

const PRIVY_APP_ID =
  Constants.expoConfig?.extra?.privyAppId ?? process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_CLIENT_ID =
  Constants.expoConfig?.extra?.privyClientId ?? process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? "";

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    setColorScheme("dark");
  }, [setColorScheme]);

  if (!PRIVY_APP_ID || !PRIVY_CLIENT_ID) {
    console.error("[_layout] Privy credentials are missing!");
  }

  return (
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
    </PrivyProvider>
  );
}
