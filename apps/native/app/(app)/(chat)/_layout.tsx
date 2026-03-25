import { Pressable, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function ChatStack() {
  if (Platform.OS === "ios") {
    return <IOSChatStack />;
  }

  return <AndroidChatStack />;
}

function AndroidChatStack() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "#0F172A" },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Chat",
          headerStyle: { backgroundColor: "#0F172A" },
          headerTintColor: "#FAFAFA",
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color="#FAFAFA" />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}

function IOSChatStack() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0F172A" },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          title: "Chat",
          headerStyle: { backgroundColor: "#0F172A" },
          headerTintColor: "#FAFAFA",
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-down" size={24} color="#FAFAFA" />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
