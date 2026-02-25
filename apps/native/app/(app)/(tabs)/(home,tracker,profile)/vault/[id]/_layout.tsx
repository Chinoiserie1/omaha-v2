import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";

export default function VaultLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const sheetOptions = {
    presentation: "formSheet" as const,
    sheetAllowedDetents: [0.35],
    sheetInitialDetentIndex: 0,
    sheetGrabberVisible: true,
    contentStyle: { backgroundColor: isDark ? "#09090B" : "#FFFFFF" },
  };

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? "#09090B" : "#FFFFFF" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="invest" options={sheetOptions} />
      <Stack.Screen name="withdraw" options={sheetOptions} />
    </Stack>
  );
}
