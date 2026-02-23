import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";

export default function OnboardingLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: isDark ? "#09090B" : "#FFFFFF" },
      }}
    />
  );
}
