import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VaultHeader } from "./VaultHeader";
import { VaultStats } from "./VaultStats";
import { VaultThesis } from "./VaultThesis";
import { VaultAllocationCard } from "./VaultAllocationCard";
import { VaultChanges } from "./VaultChanges";
import { VaultInfo } from "./VaultInfo";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001";

interface Allocation {
  asset: string;
  mint?: string;
  percentage: number;
  conviction: "low" | "medium" | "high" | "stale";
  reasoning: string;
  since: string;
  lastSignal: string;
}

interface VaultData {
  id: string;
  name: string;
  description: string;
  kolUsername: string;
  kolId: string;
  glamStatePda: string;
  glamVaultPda: string | null;
  isActive: boolean;
  kol: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
  };
  portfolio: {
    thesisSummary: string;
    allocations: Allocation[];
    changes: string[];
    updatedAt: string;
  } | null;
}

type VaultSection =
  | { type: "header"; data: VaultData }
  | { type: "stats"; data: VaultData }
  | { type: "thesis"; data: { thesisSummary: string; updatedAt: string } }
  | { type: "allocations-header" }
  | { type: "allocation"; data: Allocation }
  | { type: "changes"; data: string[] }
  | { type: "info"; data: VaultData };

interface VaultDetailProps {
  vaultId: string;
  onBack: () => void;
}

function buildSections(vault: VaultData): VaultSection[] {
  const sections: VaultSection[] = [
    { type: "header", data: vault },
    { type: "stats", data: vault },
  ];

  if (vault.portfolio?.thesisSummary) {
    sections.push({
      type: "thesis",
      data: {
        thesisSummary: vault.portfolio.thesisSummary,
        updatedAt: vault.portfolio.updatedAt,
      },
    });
  }

  const allocations = vault.portfolio?.allocations ?? [];
  if (allocations.length > 0) {
    sections.push({ type: "allocations-header" });
    for (const alloc of allocations) {
      sections.push({ type: "allocation", data: alloc });
    }
  }

  if (vault.portfolio?.changes && vault.portfolio.changes.length > 0) {
    sections.push({ type: "changes", data: vault.portfolio.changes });
  }

  sections.push({ type: "info", data: vault });

  return sections;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="px-5 pt-4 pb-2">
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </Text>
    </View>
  );
}

export function VaultDetail({ vaultId, onBack }: VaultDetailProps) {
  const [vault, setVault] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVault = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/api/vaults/${vaultId}`);
      if (!response.ok) throw new Error("Failed to load vault");
      const data = await response.json();
      setVault(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [vaultId]);

  useEffect(() => {
    fetchVault();
  }, [fetchVault]);

  const sections = useMemo(
    () => (vault ? buildSections(vault) : []),
    [vault],
  );

  const renderItem = useCallback(
    ({ item }: { item: VaultSection }) => {
      switch (item.type) {
        case "header":
          return (
            <VaultHeader
              name={item.data.name}
              kolUsername={item.data.kolUsername}
              isActive={item.data.isActive}
            />
          );
        case "stats":
          return (
            <VaultStats
              jupiterEnabled={false}
              lastRebalancedAt={null}
              vaultSymbol={item.data.name}
              glamVaultPda={item.data.glamVaultPda}
            />
          );
        case "thesis":
          return (
            <VaultThesis
              thesisSummary={item.data.thesisSummary}
              updatedAt={item.data.updatedAt}
            />
          );
        case "allocations-header":
          return <SectionHeader title="Portfolio Allocation" />;
        case "allocation":
          return (
            <VaultAllocationCard
              asset={item.data.asset}
              percentage={item.data.percentage}
              conviction={item.data.conviction}
              reasoning={item.data.reasoning}
            />
          );
        case "changes":
          return <VaultChanges changes={item.data} />;
        case "info":
          return (
            <VaultInfo
              glamStatePda={item.data.glamStatePda}
              glamVaultPda={item.data.glamVaultPda}
              vaultSymbol={item.data.name}
              kolBio={item.data.kol.bio}
            />
          );
        default:
          return null;
      }
    },
    [],
  );

  const getItemType = useCallback((item: VaultSection) => item.type, []);
  const keyExtractor = useCallback(
    (item: VaultSection, index: number) => `${item.type}-${index}`,
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={onBack}
          className="w-10 h-10 items-center justify-center rounded-full bg-zinc-900 active:bg-zinc-800"
        >
          <Ionicons name="chevron-back" size={20} color="#FAFAFA" />
        </Pressable>
        {vault ? (
          <Text
            className="flex-1 text-base font-semibold text-white ml-3"
            numberOfLines={1}
          >
            {vault.name}
          </Text>
        ) : (
          <View className="flex-1 ml-3" />
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FAFAFA" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-zinc-400 text-center mb-4">
            {error}
          </Text>
          <Pressable
            className="bg-white py-3 px-6 rounded-lg active:opacity-80"
            onPress={() => {
              setLoading(true);
              fetchVault();
            }}
          >
            <Text className="text-zinc-950 font-semibold">Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={sections}
          renderItem={renderItem}
          getItemType={getItemType}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
