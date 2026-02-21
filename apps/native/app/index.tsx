import { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";

export default function IndexScreen() {
  const { isReady, user } = usePrivy();
  const router = useRouter();
  const mountTime = useRef(Date.now());
  const [waitSeconds, setWaitSeconds] = useState(0);

  // Log on mount and track wait time
  useEffect(() => {
    console.log("[index] ========== INDEX SCREEN MOUNTED ==========");
    console.log("[index] Mount time:", new Date().toISOString());
    console.log("[index] Initial isReady:", isReady);
    console.log("[index] Initial user:", user ? "present" : "null");

    // Update wait counter every second
    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - mountTime.current) / 1000);
      setWaitSeconds(elapsed);

      // Log every 3 seconds
      if (elapsed % 3 === 0) {
        console.log(`[index] Still waiting... (${elapsed}s elapsed)`);
        console.log("[index] Current isReady:", isReady);
        console.log("[index] Current user:", user ? "present" : "null");
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      console.log("[index] IndexScreen unmounted");
    };
  }, []);

  // Log state changes and navigate
  useEffect(() => {
    const elapsed = Date.now() - mountTime.current;
    console.log("[index] ========== STATE CHANGE ==========");
    console.log("[index] Time since mount:", elapsed, "ms");
    console.log("[index] isReady changed to:", isReady);
    console.log("[index] user:", user ? JSON.stringify({ id: user.id, email: user.email?.address }) : "null");

    if (!isReady) {
      console.log("[index] Privy not ready yet, showing loading spinner...");
      return;
    }

    console.log("[index] Privy is READY! Navigating...");

    if (user) {
      console.log("[index] User exists, navigating to /(app)");
      router.replace("/(app)");
    } else {
      console.log("[index] No user, navigating to /sign-in");
      router.replace("/sign-in");
    }
  }, [isReady, user, router]);

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <ActivityIndicator size="large" color="#18181B" />
      <Text className="mt-4 text-gray-500 text-sm">
        {isReady ? "Redirecting..." : "Initializing..."}
      </Text>

      {/* Dev debug info */}
      {__DEV__ && (
        <View className="mt-4 p-3 bg-gray-100 rounded-lg w-full">
          <Text className="text-gray-600 text-xs font-mono">
            isReady: {String(isReady)}
          </Text>
          <Text className="text-gray-600 text-xs font-mono">
            user: {user ? "authenticated" : "null"}
          </Text>
          <Text className="text-gray-600 text-xs font-mono">
            waiting: {waitSeconds}s
          </Text>
        </View>
      )}

      {/* Timeout warning */}
      {waitSeconds >= 10 && !isReady && (
        <View className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg w-full">
          <Text className="text-amber-800 text-sm font-semibold">
            Taking longer than expected...
          </Text>
          <Text className="text-amber-700 text-xs mt-1">
            Check console logs for Privy initialization status.
            {"\n"}Possible issues:
            {"\n"}• Missing EXPO_PUBLIC_PRIVY_APP_ID
            {"\n"}• Missing EXPO_PUBLIC_PRIVY_CLIENT_ID
            {"\n"}• Network connectivity issue
          </Text>
        </View>
      )}
    </View>
  );
}
