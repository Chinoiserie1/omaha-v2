import { View, Text, Pressable } from "react-native";
import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/ui/badge";
import { VaultProfilePicture } from "@/components/vault/VaultProfilePicture";

interface VaultRowProps {
  name: string;
  description: string;
  category: string;
  performancePercent: number;
  performancePeriod: string;
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
  description,
  category,
  performancePercent,
  performancePeriod,
  followersCount,
  onPress,
}: VaultRowProps) {
  const isPositive = performancePercent >= 0;
  const perfColor = isPositive ? "text-green-400" : "text-red-400";
  const perfSign = isPositive ? "+" : "";

  return (
    <Pressable
      className="flex-row items-center py-4 active:opacity-70"
      style={{ borderBottomWidth: 0.5, borderBottomColor: "rgba(248,250,252,0.15)" }}
      onPress={onPress}
    >
      <VaultProfilePicture name={name} size={52} />

      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-medium text-muted-foreground">
            {category}
          </Text>
          <Text className={`text-xs font-bold ${perfColor}`}>
            {perfSign}
            {performancePercent}% ({performancePeriod})
          </Text>
        </View>

        <Text
          className="mt-0.5 text-base font-semibold text-foreground"
          numberOfLines={1}
        >
          {name}
        </Text>

        <Text
          className="mt-0.5 text-sm italic text-muted-foreground"
          numberOfLines={1}
        >
          {description}
        </Text>

        <View className="mt-1.5 flex-row items-center gap-2">
          <Badge variant="secondary" className="px-2 py-0.5">
            <Text className="text-xs font-medium text-muted-foreground">
              BETA
            </Text>
          </Badge>
          <View className="flex-row items-center gap-1">
            <Ionicons name="people-outline" size={12} color="#94A3B8" />
            <Text className="text-xs text-muted-foreground">
              {formatFollowers(followersCount)}
            </Text>
          </View>
        </View>
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
