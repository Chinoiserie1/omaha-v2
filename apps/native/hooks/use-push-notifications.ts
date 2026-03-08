import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useAuth } from "../contexts/auth-context";
import { apiClient } from "../lib/api-client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("[PushNotifications] No projectId found");
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return token;
}

export function usePushNotifications() {
  const { status } = useAuth();
  const registered = useRef(false);

  // Register token when authenticated
  useEffect(() => {
    if (status !== "authenticated" || registered.current) return;

    const setup = async () => {
      try {
        const token = await getExpoPushToken();
        if (!token) return;

        const platform = Platform.OS === "ios" ? "ios" : "android";
        await apiClient.post("/api/push-tokens/register", { token, platform });
        registered.current = true;
        console.log("[PushNotifications] Token registered");
      } catch (err) {
        console.warn("[PushNotifications] Registration failed:", err);
      }
    };

    setup();
  }, [status]);

  // Handle notification tap → deep link
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === "significant_tweet") {
          router.push("/(app)/(tabs)/(home)" as never);
        }
      },
    );

    return () => subscription.remove();
  }, []);
}

export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) return;
    await apiClient.post("/api/push-tokens/unregister", { token });
  } catch {
    // Non-fatal — token will expire anyway
  }
}
