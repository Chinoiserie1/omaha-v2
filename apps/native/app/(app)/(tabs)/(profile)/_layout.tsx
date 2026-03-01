import { Stack } from "expo-router";

export default function ProfileStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#09090B" },
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
