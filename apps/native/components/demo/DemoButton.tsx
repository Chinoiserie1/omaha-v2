import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DemoButtonProps {
  onPress: () => void;
}

export function DemoButton({ onPress }: DemoButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
      style={{ backgroundColor: "rgba(20, 184, 166, 0.15)" }}
    >
      <Ionicons name="play-circle" size={16} color="#14B8A6" />
      <Text className="text-xs font-semibold" style={{ color: "#14B8A6" }}>
        Demo
      </Text>
    </Pressable>
  );
}
