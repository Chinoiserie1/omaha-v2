import { View, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import type { TrendingQuant } from "@repo/shared";

interface TrendingQuantRowProps {
  quant: TrendingQuant;
}

export function TrendingQuantRow({ quant }: TrendingQuantRowProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        if (quant.vaultId) {
          router.push(`/(app)/(tabs)/(home)/vault/${quant.vaultId}` as never);
        } else {
          router.push(`/(app)/(tabs)/(explore)/quant/${quant.id}` as never);
        }
      }}
      className="flex-row items-center px-5 py-3 active:opacity-70"
    >
      {quant.avatarUrl ? (
        <Image
          source={{ uri: quant.avatarUrl }}
          className="mr-3 h-10 w-10 rounded-full bg-muted"
        />
      ) : (
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Text className="text-sm font-bold text-muted-foreground">
            {quant.username[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground">
          @{quant.username}
        </Text>
        {quant.displayName && (
          <Text className="text-sm text-muted-foreground">
            {quant.displayName}
          </Text>
        )}
      </View>
      <View className="items-end">
        <Text className="text-sm font-medium text-foreground">
          {formatCount(quant.followerCount)} followers
        </Text>
        <Text className="text-xs text-muted-foreground">
          {quant.signalCount} signal{quant.signalCount !== 1 ? "s" : ""}
        </Text>
      </View>
    </Pressable>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
