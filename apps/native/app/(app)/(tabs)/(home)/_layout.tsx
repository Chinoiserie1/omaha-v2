import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";

export default function HomeStack() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? "#09090B" : "#FFFFFF" },
      }}
    />
  );
}
