import { useEffect, useRef } from "react";
import { usePathname, useSegments } from "expo-router";
import { usePostHog } from "posthog-react-native";

/**
 * Tracks screen views via PostHog using expo-router hooks.
 *
 * Must be rendered **inside** the navigator (e.g. as a sibling of <Stack>)
 * so that usePathname/useSegments have access to navigation state.
 *
 * Replaces PostHogProvider's built-in `captureScreens` which calls
 * @react-navigation/native's useNavigationState — that hook throws
 * when rendered outside a navigator context.
 */
export function PostHogScreenTracker() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const segments = useSegments();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog || !pathname || pathname === previousPath.current) return;

    previousPath.current = pathname;
    posthog.screen(pathname, { segments: segments.join("/") });
  }, [posthog, pathname, segments]);

  return null;
}
