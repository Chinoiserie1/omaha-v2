import { Pressable } from "react-native";
import {
  Platform,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useChatSearch } from "@/contexts/chat-search";

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
  const { setSearchText } = useChatSearch();

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
          headerLargeTitleEnabled: true,
          headerLargeTitleStyle: {
            color: "#FAFAFA",
            fontWeight: "700",
          },
          headerLargeStyle: { backgroundColor: "#0F172A" },
          headerShadowVisible: false,
          headerSearchBarOptions: {
            placeholder: "Search messages...",
            textColor: "#FAFAFA",
            tintColor: "#FAFAFA",
            barTintColor: "rgba(255,255,255,0.08)",
            hideWhenScrolling: false,
            onChangeText: (
              e: NativeSyntheticEvent<TextInputFocusEventData>,
            ) => setSearchText(e.nativeEvent.text),
            onCancelButtonPress: () => setSearchText(""),
          },
        }}
      />
    </Stack>
  );
}
