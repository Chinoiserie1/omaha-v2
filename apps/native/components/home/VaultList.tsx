import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { VaultRow } from "./VaultRow";
import { VaultSectionHeader } from "./VaultSectionHeader";
import { ExploreMoreFooter } from "./ExploreMoreFooter";
import { DisclaimerText } from "./DisclaimerText";
import { getVaultMockData } from "./vault-mock-data";
import { useVaults, type VaultSummary } from "../../hooks/queries/use-vaults";

function ListHeader() {
  return <VaultSectionHeader />;
}

export function VaultList() {
  const router = useRouter();
  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useVaults();

  const vaults = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data]
  );

  const renderItem = useCallback(
    ({ item }: { item: VaultSummary }) => {
      const mock = getVaultMockData(item.id);
      return (
        <VaultRow
          name={item.name}
          description={item.description}
          category={mock.category}
          performancePercent={item.performancePercent}
          followersCount={mock.followersCount}
          onPress={() => router.push(`/(app)/(tabs)/(home)/vault/${item.id}`)}
        />
      );
    },
    [router]
  );

  const keyExtractor = useCallback((item: VaultSummary) => item.id, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const ListFooter = useCallback(() => {
    return (
      <View>
        {hasNextPage && <ExploreMoreFooter isLoading={isFetchingNextPage} />}
        <DisclaimerText />
      </View>
    );
  }, [hasNextPage, isFetchingNextPage]);

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

  if (vaults.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-center text-base text-muted-foreground">
          No vaults available
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={vaults}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      refreshing={isRefetching}
      onRefresh={() => refetch()}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeader}
      ListFooterComponent={ListFooter}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
