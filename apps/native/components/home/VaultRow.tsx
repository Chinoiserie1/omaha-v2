import { View, Text, Pressable } from "react-native";
import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/ui/badge";
import { VaultProfilePicture } from "@/components/vault/VaultProfilePicture";

interface VaultRowProps {
  name: string;
  avatarUrl?: string | null;
  description: string;
  category: string;
  performancePercent: number | null;
  followersCount: number;
  onPress?: () => void;
}

function formatFollowers(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
}

export const VaultRow = memo(function VaultRow({
  name,
  avatarUrl,
  description,
  category,
  performancePercent,
  followersCount,
  onPress,
}: VaultRowProps) {
  const hasPerf = performancePercent !== null;
  const isPositive = hasPerf && performancePercent >= 0;
  const perfColor = !hasPerf
    ? "text-muted-foreground"
    : isPositive
      ? "text-green-400"
      : "text-red-400";
  const perfSign = hasPerf && isPositive ? "+" : "";

  return (
    <Pressable
      className="flex-row items-center py-4 active:opacity-70"
      style={{
        borderBottomWidth: 0.5,
        borderBottomColor: "rgba(248,250,252,0.15)",
      }}
      onPress={onPress}
    >
      <VaultProfilePicture name={name} avatarUrl={avatarUrl} size={52} />

      <View className="flex-1 ml-3">
        <View className="flex-row justify-between items-center">
          <Text
            className="mt-0.5 text-base font-semibold text-foreground"
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text className={`text-xs font-bold ${perfColor}`}>
            {hasPerf ? `${perfSign}${performancePercent}%` : "--"}
          </Text>
        </View>

        <Text
          className="mt-0.5 text-sm italic text-muted-foreground"
          numberOfLines={2}
        >
          {description}
        </Text>

        {/* <View className="mt-1.5 flex-row items-center gap-2">
          <Badge variant="secondary" className="px-2 py-0.5">
            <Text className="text-xs font-medium text-muted-foreground">
              BETA
            </Text>
          </Badge>
          <View className="flex-row gap-1 items-center">
            <Ionicons name="people-outline" size={12} color="#94A3B8" />
            <Text className="text-xs text-muted-foreground">
              {formatFollowers(followersCount)}
            </Text>
          </View>
        </View> */}
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color="#64748B"
        style={{ marginLeft: 8 }}
      />
    </Pressable>
  );
});
