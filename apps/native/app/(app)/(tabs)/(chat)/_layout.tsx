import { Stack } from "expo-router";

export default function ChatStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0F172A" },
      }}
    />
  );
}
