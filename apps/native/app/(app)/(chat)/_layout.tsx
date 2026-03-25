import { Pressable, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useChatNewSession } from "@/hooks/use-chat-new-session";

export default function ChatStack() {
  if (Platform.OS === "ios") {
    return <IOSChatStack />;
  }

  return <AndroidChatStack />;
}

function AndroidChatStack() {
  const router = useRouter();
  const { requestNewSession } = useChatNewSession();

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
          headerRight: () => (
            <Pressable onPress={requestNewSession} hitSlop={8}>
              <Ionicons name="create-outline" size={22} color="#FAFAFA" />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}

function IOSChatStack() {
  const router = useRouter();
  const { requestNewSession } = useChatNewSession();

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
          headerRight: () => (
            <Pressable onPress={requestNewSession} hitSlop={8}>
              <Ionicons name="create-outline" size={22} color="#FAFAFA" />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
