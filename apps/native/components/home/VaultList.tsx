import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useCallback } from "react";
import { useRouter } from "expo-router";
import { VaultRow } from "./VaultRow";
import { VaultSectionHeader } from "./VaultSectionHeader";
import { ExploreMoreButton } from "./ExploreMoreButton";
import { DisclaimerText } from "./DisclaimerText";
import { getVaultMockData } from "./vault-mock-data";
import { useVaults } from "../../hooks/queries/use-vaults";

interface Allocation {
  asset: string;
  percentage: number;
}

interface VaultSummary {
  id: string;
  name: string;
  description: string;
  kolUsername: string;
  portfolio: {
    allocations: Allocation[];
  } | null;
}

function ListHeader() {
  return <VaultSectionHeader />;
}

function ListFooter() {
  return (
    <View>
      <ExploreMoreButton />
      <DisclaimerText />
    </View>
  );
}

export function VaultList() {
  const router = useRouter();
  const { data: vaults, isLoading, error, refetch, isRefetching } = useVaults();

  const renderItem = useCallback(
    ({ item }: { item: VaultSummary }) => {
      const mock = getVaultMockData(item.id);
      return (
        <VaultRow
          name={item.name}
          description={item.description}
          category={mock.category}
          performancePercent={mock.performancePercent}
          performancePeriod={mock.performancePeriod}
          followersCount={mock.followersCount}
          onPress={() => router.push(`/(app)/(tabs)/(home)/vault/${item.id}`)}
        />
      );
    },
    [router],
  );

  const keyExtractor = useCallback((item: VaultSummary) => item.id, []);

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

  if (!vaults || vaults.length === 0) {
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
      ListHeaderComponent={ListHeader}
      ListFooterComponent={ListFooter}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
