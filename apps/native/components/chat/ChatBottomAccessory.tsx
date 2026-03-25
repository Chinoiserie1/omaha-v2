import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

interface ChatBottomAccessoryProps {
  placement: "regular" | "inline";
}

export function ChatBottomAccessory({ placement }: ChatBottomAccessoryProps) {
  const isInline = placement === "inline";

  return (
    <View style={isInline ? styles.containerInline : styles.container}>
      <Pressable
        style={isInline ? styles.barInline : styles.bar}
        onPress={() => router.push("/(app)/(chat)")}
      >
        <Ionicons name="sparkles" size={isInline ? 16 : 18} color="#71717A" />
        <Text
          style={isInline ? styles.placeholderInline : styles.placeholder}
          numberOfLines={1}
        >
          Ask about your strategy...
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  containerInline: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  barInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  placeholder: {
    color: "#71717A",
    fontSize: 15,
    flex: 1,
  },
  placeholderInline: {
    color: "#71717A",
    fontSize: 13,
    flex: 1,
  },
});
