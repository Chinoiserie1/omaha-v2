import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { useInfiniteVaultRebalances } from "../../hooks/queries/use-infinite-vault-rebalances";
import type { RebalanceWithSnapshot } from "../../hooks/queries/use-vault-rebalances";
import { RebalanceItem } from "./RebalanceItem";

interface StrategyUpdatesListProps {
  vaultId: string;
  onBack: () => void;
}

export function StrategyUpdatesList({ vaultId, onBack }: StrategyUpdatesListProps) {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteVaultRebalances(vaultId);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const rebalances = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: RebalanceWithSnapshot; index: number }) => (
      <View className="mx-5">
        <RebalanceItem
          event={item}
          isFirst={index === 0}
          isLast={index === rebalances.length - 1 && !hasNextPage}
        />
      </View>
    ),
    [rebalances.length, hasNextPage],
  );

  const keyExtractor = useCallback(
    (item: RebalanceWithSnapshot) => item.id,
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={onBack}
          className="justify-center items-center w-10 h-10 rounded-full bg-card active:bg-secondary"
        >
          <Ionicons name="chevron-back" size={20} color="#F8FAFC" />
        </Pressable>
        <Text className="ml-3 text-base font-semibold text-foreground">
          Strategy Updates
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#F8FAFC" />
        </View>
      ) : (
        <FlashList
          data={rebalances}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="items-center py-4">
                <ActivityIndicator size="small" color="#64748B" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center px-6 pt-20">
              <Text className="text-sm text-muted-foreground">
                No strategy updates yet
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
