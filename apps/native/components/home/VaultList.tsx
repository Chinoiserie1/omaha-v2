import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import { VaultCard } from "../ui/VaultCard";

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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export function VaultList() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [vaults, setVaults] = useState<VaultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVaults = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/api/vaults`);
      if (!response.ok) throw new Error("Failed to load vaults");
      const data = await response.json();
      setVaults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVaults();
  }, [fetchVaults]);

  const renderItem = useCallback(
    ({ item }: { item: VaultSummary }) => (
      <VaultCard
        name={item.name}
        description={item.description}
        allocations={
          (item.portfolio?.allocations as Allocation[] | undefined) ?? []
        }
      />
    ),
    []
  );

  const keyExtractor = useCallback((item: VaultSummary) => item.id, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator
          size="large"
          color={isDark ? "#FAFAFA" : "#18181B"}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center py-20 px-6">
        <Text className="text-base text-zinc-500 dark:text-zinc-400 text-center mb-4">
          {error}
        </Text>
        <TouchableOpacity
          className="bg-zinc-900 dark:bg-white py-3 px-6 rounded-lg"
          onPress={() => {
            setLoading(true);
            fetchVaults();
          }}
        >
          <Text className="text-white dark:text-zinc-950 font-semibold">
            Try Again
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (vaults.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-base text-zinc-500 dark:text-zinc-400 text-center">
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
      refreshing={refreshing}
      onRefresh={handleRefresh}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
