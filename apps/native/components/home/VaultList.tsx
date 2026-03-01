import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useCallback } from "react";
import { useRouter } from "expo-router";
import { VaultCard } from "../ui/VaultCard";
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

export function VaultList() {
  const router = useRouter();
  const { data: vaults, isLoading, error, refetch, isRefetching } = useVaults();

  const renderItem = useCallback(
    ({ item }: { item: VaultSummary }) => (
      <VaultCard
        name={item.name}
        description={item.description}
        allocations={
          (item.portfolio?.allocations as Allocation[] | undefined) ?? []
        }
        onPress={() => router.push(`/(app)/(tabs)/(home)/vault/${item.id}`)}
      />
    ),
    [router]
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
      <View className="flex-1 items-center justify-center py-20 px-6">
        <Text className="text-base text-muted-foreground text-center mb-4">
          {error.message}
        </Text>
        <TouchableOpacity
          className="bg-primary py-3 px-6 rounded-lg"
          onPress={() => refetch()}
        >
          <Text className="text-primary-foreground font-semibold">
            Try Again
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!vaults || vaults.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-base text-muted-foreground text-center">
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
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
