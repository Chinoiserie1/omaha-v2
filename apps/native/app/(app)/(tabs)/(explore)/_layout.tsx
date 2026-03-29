import { Stack } from "expo-router";

export default function ExploreStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0F172A" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: true }} />
      <Stack.Screen name="quant/[id]" options={{ headerShown: true }} />
    </Stack>
  );
}
