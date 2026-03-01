import { Stack } from "expo-router";
import { Platform } from "react-native";

export default function VaultLayout() {
  const sheetOptions = {
    presentation: "formSheet" as const,
    sheetAllowedDetents: [0.4, 0.6],
    sheetInitialDetentIndex: 0,
    sheetGrabberVisible: Platform.OS === "ios",
    contentStyle: {
      flex: 1,
      backgroundColor: "#0F172A",
    },
  };

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0F172A" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="invest" options={sheetOptions} />
      <Stack.Screen name="withdraw" options={sheetOptions} />
    </Stack>
  );
}
