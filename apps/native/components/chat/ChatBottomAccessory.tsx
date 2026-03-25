import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

interface ChatBottomAccessoryProps {
  placement: "regular" | "inline";
}

export function ChatBottomAccessory({ placement: _placement }: ChatBottomAccessoryProps) {
  return (
    <Pressable
      style={styles.container}
      onPress={() => router.push("/(app)/(chat)")}
    >
      <Ionicons name="sparkles" size={22} color="#FFFFFF" />
      <Text style={styles.label} numberOfLines={1}>
        Manage Portfolio
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
