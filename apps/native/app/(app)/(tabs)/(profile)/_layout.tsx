import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";

export default function ProfileStack() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? "#09090B" : "#FFFFFF" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="deposit"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="withdraw"
        options={{ presentation: "modal" }}
      />
    </Stack>
  );
}
