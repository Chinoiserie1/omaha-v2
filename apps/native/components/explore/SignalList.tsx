import { View, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { useCallback } from "react";
import { Text } from "@/components/ui/text";
import { SignalCard } from "./SignalCard";
import { useExploreSearch } from "../../hooks/queries/use-explore-search";
import type { ExploreSignal } from "@repo/shared";

interface SignalListProps {
  asset: string;
}

export function SignalList({ asset }: SignalListProps) {
  const { data, isLoading, error, refetch, isRefetching } =
    useExploreSearch(asset);

  const renderItem = useCallback(
    ({ item }: { item: ExploreSignal }) => <SignalCard signal={item} />,
    [],
  );

  const keyExtractor = useCallback(
    (item: ExploreSignal) => item.tweet.tweetId,
    [],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator size="large" color="#F8FAFC" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center px-6 py-20">
        <Text className="mb-4 text-center text-base text-muted-foreground">
          {error.message}
        </Text>
        <TouchableOpacity
          className="rounded-lg bg-primary px-6 py-3"
          onPress={() => refetch()}
        >
          <Text className="font-semibold text-primary-foreground">
            Try Again
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const results = data?.results ?? [];

  if (results.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-center text-base text-muted-foreground">
          No signals found for {asset}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={results}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      refreshing={isRefetching}
      onRefresh={() => refetch()}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
