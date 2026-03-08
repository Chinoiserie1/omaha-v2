import { Platform, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function QuantStack() {
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
        options={
          Platform.OS === "ios"
            ? {
                headerShown: true,
                title: "Quant",
                headerStyle: { backgroundColor: "#0F172A" },
                headerTintColor: "#FAFAFA",
                headerLargeTitleEnabled: true,
                headerLargeTitleStyle: {
                  color: "#FAFAFA",
                  fontWeight: "700",
                },
                headerLargeStyle: { backgroundColor: "#0F172A" },
                headerShadowVisible: false,
                headerRight: () => (
                  <Pressable
                    onPress={() =>
                      router.push("/(app)/(tabs)/(chat)" as never)
                    }
                    hitSlop={8}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={22}
                      color="#FAFAFA"
                    />
                  </Pressable>
                ),
              }
            : {}
        }
      />
      <Stack.Screen name="chat" />
    </Stack>
  );
}
