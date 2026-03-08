import { View, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { useExploreTrending } from "../../hooks/queries/use-explore-search";
import { TrendingAssetRow } from "./TrendingAssetRow";
import { TrendingQuantRow } from "./TrendingQuantRow";

interface TrendingContentProps {
  onSelectAsset: (symbol: string) => void;
}

export function TrendingContent({ onSelectAsset }: TrendingContentProps) {
  const { data, isLoading, isError, refetch } = useExploreTrending();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="mb-3 text-center text-base text-muted-foreground">
          Failed to load trending data
        </Text>
        <Pressable onPress={() => refetch()}>
          <Text className="text-base font-medium text-primary">Retry</Text>
        </Pressable>
      </View>
    );
  }

  const { trendingAssets = [], topQuants = [] } = data ?? {};

  if (trendingAssets.length === 0 && topQuants.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-base text-muted-foreground">
          No trending data yet
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {trendingAssets.length > 0 && (
        <View className="mb-4">
          <Text className="mb-2 px-5 text-lg font-bold text-foreground">
            Trending Assets
          </Text>
          {trendingAssets.map((asset) => (
            <TrendingAssetRow
              key={asset.symbol}
              asset={asset}
              onPress={onSelectAsset}
            />
          ))}
        </View>
      )}

      {topQuants.length > 0 && (
        <View className="mb-8">
          <Text className="mb-2 px-5 text-lg font-bold text-foreground">
            Top Quants
          </Text>
          {topQuants.map((quant) => (
            <TrendingQuantRow key={quant.id} quant={quant} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
