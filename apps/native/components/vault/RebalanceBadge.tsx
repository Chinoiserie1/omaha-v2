import { View, Text } from "react-native";

interface BadgeProps {
  label: string;
  variant: "blue" | "gray" | "violet";
}

const colors = {
  blue: { bg: "rgba(59,130,246,0.15)", text: "#3B82F6" },
  gray: { bg: "rgba(100,116,139,0.15)", text: "#94A3B8" },
  violet: { bg: "rgba(139,92,246,0.15)", text: "#A78BFA" },
} as const;

export function RebalanceBadge({ label, variant }: BadgeProps) {
  const { bg, text } = colors[variant];

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: text, fontSize: 11, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}
